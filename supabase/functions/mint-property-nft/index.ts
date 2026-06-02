// Supabase Edge Function: mint-property-nft
// Signs the Soroban PropertyNFT.mint() call using the contract ADMIN key (deployer).
// The admin key is stored as a Supabase secret (STELLAR_DEPLOYER_SECRET).
// Called from the frontend after a property is successfully saved to the database.

import { Buffer } from "node:buffer";
import process from "node:process";

// We MUST polyfill before loading stellar-sdk. 
if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer;
}
if (typeof globalThis.process === "undefined") {
  globalThis.process = process;
}

// We MUST use dynamic import here! Static imports are hoisted and execute BEFORE
// the polyfills above, which causes the 503 BOOT_ERROR we just fixed.
const StellarSdk = await import("npm:@stellar/stellar-sdk@^12");
const {
  Keypair,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  Contract,
  SorobanRpc,
  Address,
  xdr,
} = StellarSdk;

const NETWORK_PASSPHRASE = Networks.TESTNET;
const RPC_URL = "https://soroban-testnet.stellar.org";
const NFT_CONTRACT_ID =
  Deno.env.get("PROPERTY_NFT_CONTRACT_ID") ||
  "CCHYA2GV5U6VK3W4TQFTG7D3IOKGO6EBDR6OB3BM3R5RPGV7GII5ZZZI";
const POLL_INTERVAL_MS = 1500;
const MAX_TX_POLL_ATTEMPTS = 20;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function scValToNative(value: any) {
  if (!value) return null;

  switch (value.switch().name) {
    case "scvU32":
      return value.u32();
    case "scvString":
      // FIX 1: use .bytes() not .str() — scvString stores raw bytes in the SDK
      return value.bytes().toString("utf-8");
    case "scvBool":
      return value.b();
    case "scvVoid":
      return null;
    default:
      return value;
  }
}

function decodeScValFromBase64(encoded?: string | null) {
  if (!encoded) return null;
  return scValToNative(xdr.ScVal.fromXDR(encoded, "base64"));
}

function extractFnReturnFromDiagnostics(diagnosticEventsXdr: string[] = [], methodName: string) {
  for (const encoded of diagnosticEventsXdr) {
    const diagnosticEvent = xdr.DiagnosticEvent.fromXDR(encoded, "base64");
    const body = diagnosticEvent.event().body().v0();
    const topics = body.topics().map(scValToNative);

    if (topics[0] === "fn_return" && topics[1] === methodName) {
      return scValToNative(body.data());
    }
  }

  return null;
}

async function getRawSorobanTransaction(hash: string) {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: hash,
      method: "getTransaction",
      params: { hash },
    }),
  });

  const payload = await response.json();
  if (payload.error) {
    throw new Error(payload.error.message || `Raw RPC getTransaction failed for ${hash}`);
  }

  return payload.result;
}

async function waitForSorobanTransaction(
  server: SorobanRpc.Server,
  hash: string,
  methodName: string,
  fallbackReturnValue: any,
) {
  for (let attempt = 0; attempt < MAX_TX_POLL_ATTEMPTS; attempt += 1) {
    let sdkResponse: Awaited<ReturnType<typeof server.getTransaction>> | null = null;

    try {
      sdkResponse = await server.getTransaction(hash);
    } catch (sdkError) {
      // FIX 5: only fall back to raw RPC on SDK-level transport errors,
      // not on chain-level failures — those are handled below.
      console.warn("SDK getTransaction threw, falling back to raw RPC:", sdkError);

      const rawResponse = await getRawSorobanTransaction(hash);

      if (rawResponse.status === "SUCCESS") {
        return {
          hash,
          returnValue:
            decodeScValFromBase64(rawResponse.returnValue) ??
            extractFnReturnFromDiagnostics(rawResponse.diagnosticEventsXdr || [], methodName) ??
            scValToNative(fallbackReturnValue),
        };
      }

      if (rawResponse.status === "FAILED") {
        throw new Error(`Mint transaction failed on-chain for hash ${hash}`);
      }

      // Still NOT_FOUND / pending — sleep and retry
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    // SDK call succeeded — check the status without swallowing FAILED
    if (sdkResponse.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      return {
        hash,
        returnValue: scValToNative(sdkResponse.returnValue ?? fallbackReturnValue),
      };
    }

    if (sdkResponse.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Mint transaction failed on-chain for hash ${hash}`);
    }

    // NOT_FOUND / still pending
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`Timed out waiting for mint transaction ${hash}`);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return json("ok", 200);
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const { ownerAddress, propertyId, tokenUri } = await req.json();

    if (!ownerAddress || !propertyId || !tokenUri) {
      return json({ error: "Missing required fields: ownerAddress, propertyId, tokenUri" }, 400);
    }

    // Load admin keypair from Supabase secret
    const deployerSecret = Deno.env.get("STELLAR_DEPLOYER_SECRET");
    if (!deployerSecret) {
      return json({ error: "Server misconfiguration: deployer secret not set" }, 500);
    }

    const adminKeypair = Keypair.fromSecret(deployerSecret);
    const adminAddress = adminKeypair.publicKey();

    // Ensure property_id is a valid u32
    const numericPropertyId = parseInt(propertyId, 10);
    if (isNaN(numericPropertyId) || numericPropertyId < 0) {
      return json({ error: "Property must have a valid on-chain property ID before NFT minting" }, 400);
    }

    // Set up RPC server
    const server = new SorobanRpc.Server(RPC_URL);

    // Build the contract invocation
    const contract = new Contract(NFT_CONTRACT_ID);
    const account = await server.getAccount(adminAddress);

    const txBuilder = new TransactionBuilder(account, {
      // FIX 4: use simulation-derived fee instead of a flat multiplier.
      // We set a generous base here; prepareTransaction will override it
      // with the actual resource fee from simulation.
      fee: String(Number(BASE_FEE) * 100),
      networkPassphrase: NETWORK_PASSPHRASE,
    }).setTimeout(180);

    // FIX 2: use Address.fromString().toScVal() for address arguments
    const mintOp = contract.call(
      "mint",
      Address.fromString(adminAddress).toScVal(),          // admin
      Address.fromString(ownerAddress).toScVal(),          // to
      StellarSdk.nativeToScVal(numericPropertyId, { type: "u32" }), // property_id
      StellarSdk.nativeToScVal(tokenUri, { type: "string" }),        // token_uri
    );

    const txInitial = txBuilder.addOperation(mintOp).build();

    // Simulate first to get footprint & fees
    const simulation = await server.simulateTransaction(txInitial);
    if (SorobanRpc.Api.isSimulationError(simulation)) {
      return json({ error: `Simulation failed: ${simulation.error}` }, 500);
    }
    const simulatedReturnValue = simulation.result?.retval ?? null;

    // prepareTransaction assembles the real soroban resource fee from simulation
    const tx = await server.prepareTransaction(txInitial);
    tx.sign(adminKeypair);

    const result = await server.sendTransaction(tx);

    if (result.status === "ERROR") {
      return json({ error: "Transaction submission failed", details: result }, 500);
    }

    const finalResult = await waitForSorobanTransaction(server, result.hash, "mint", simulatedReturnValue);
    const tokenId = finalResult.returnValue;

    if (typeof tokenId !== "number") {
      return json({ error: "Mint did not return a valid token ID" }, 500);
    }

    return json({
      success: true,
      txHash: finalResult.hash,
      tokenId: tokenId.toString(),
      contractId: NFT_CONTRACT_ID,
      admin: adminAddress,
      owner: ownerAddress,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("mint-property-nft error:", message);
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
