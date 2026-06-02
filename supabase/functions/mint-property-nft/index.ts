// Supabase Edge Function: mint-property-nft
// Signs the Soroban PropertyNFT.mint() call using the contract ADMIN key (deployer).
// The admin key is stored as a Supabase secret (STELLAR_DEPLOYER_SECRET).
// Called from the frontend after a property is successfully saved to the database.

import { Buffer } from "node:buffer";
import process from "node:process";

// Polyfill globals BEFORE any stellar-sdk code loads.
if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer;
}
if (typeof globalThis.process === "undefined") {
  globalThis.process = process;
}

// Use a stable, well-tested version that is known to work in Deno / Supabase Edge.
// v12 is the last version that shipped SorobanRpc as a named export without issues.
// We import the /rpc sub-path directly to avoid the problematic SorobanRpc re-export.
const StellarSdk = await import("npm:@stellar/stellar-sdk@12");
const {
  Keypair,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  Contract,
  SorobanRpc,
  Address,
  xdr,
  nativeToScVal,
} = StellarSdk;

const NETWORK_PASSPHRASE = Networks.TESTNET;
const RPC_URL = "https://soroban-testnet.stellar.org";
const NFT_CONTRACT_ID =
  Deno.env.get("PROPERTY_NFT_CONTRACT_ID") ||
  "CCHYA2GV5U6VK3W4TQFTG7D3IOKGO6EBDR6OB3BM3R5RPGV7GII5ZZZI";
const POLL_INTERVAL_MS = 1500;
const MAX_TX_POLL_ATTEMPTS = 20;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function scValToNative(value: any): any {
  if (!value) return null;

  const name = value.switch().name;
  switch (name) {
    case "scvU32":
      return value.u32();
    case "scvI32":
      return value.i32();
    case "scvU64":
      return Number(value.u64());
    case "scvString":
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
  try {
    return scValToNative(xdr.ScVal.fromXDR(encoded, "base64"));
  } catch {
    return null;
  }
}

function extractFnReturnFromDiagnostics(
  diagnosticEventsXdr: string[] = [],
  methodName: string,
) {
  for (const encoded of diagnosticEventsXdr) {
    try {
      const diagnosticEvent = xdr.DiagnosticEvent.fromXDR(encoded, "base64");
      const contractEvent = diagnosticEvent.event();
      const body = contractEvent.body();

      // v0() may throw on newer protocol — guard with try/catch
      let topics: any[] = [];
      let data: any = null;
      try {
        const v0 = body.v0();
        topics = v0.topics().map(scValToNative);
        data = scValToNative(v0.data());
      } catch {
        continue;
      }

      if (topics[0] === "fn_return" && topics[1] === methodName) {
        return data;
      }
    } catch {
      continue;
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
    throw new Error(
      payload.error.message || `Raw RPC getTransaction failed for ${hash}`,
    );
  }
  return payload.result;
}

async function waitForSorobanTransaction(
  server: any,
  hash: string,
  methodName: string,
  fallbackReturnValue: any,
) {
  for (let attempt = 0; attempt < MAX_TX_POLL_ATTEMPTS; attempt += 1) {
    // Always use raw RPC to avoid SDK XDR decode issues with newer protocol versions
    const rawResponse = await getRawSorobanTransaction(hash);

    if (rawResponse.status === "SUCCESS") {
      const returnValue =
        decodeScValFromBase64(rawResponse.returnValue) ??
        extractFnReturnFromDiagnostics(
          rawResponse.diagnosticEventsXdr || [],
          methodName,
        ) ??
        scValToNative(fallbackReturnValue);

      return { hash, returnValue };
    }

    if (rawResponse.status === "FAILED") {
      // Try to get diagnostic info
      const diagInfo = (rawResponse.diagnosticEventsXdr || []).slice(0, 3);
      throw new Error(
        `Mint transaction failed on-chain for hash ${hash}. Diagnostics: ${diagInfo.join(", ")}`,
      );
    }

    // NOT_FOUND or still pending — wait and retry
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`Timed out waiting for mint transaction ${hash}`);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
      return json(
        { error: "Missing required fields: ownerAddress, propertyId, tokenUri" },
        400,
      );
    }

    // Load admin keypair from Supabase secret
    const deployerSecret = Deno.env.get("STELLAR_DEPLOYER_SECRET");
    if (!deployerSecret) {
      return json(
        { error: "Server misconfiguration: deployer secret not set" },
        500,
      );
    }

    const adminKeypair = Keypair.fromSecret(deployerSecret);
    const adminAddress = adminKeypair.publicKey();

    // Ensure property_id is a valid u32
    const numericPropertyId = parseInt(propertyId, 10);
    if (isNaN(numericPropertyId) || numericPropertyId < 0) {
      return json(
        {
          error:
            "Property must have a valid on-chain property ID before NFT minting",
        },
        400,
      );
    }

    console.log(`[mint-property-nft] Minting NFT for property #${numericPropertyId} to ${ownerAddress}`);
    console.log(`[mint-property-nft] Admin: ${adminAddress}`);
    console.log(`[mint-property-nft] Contract: ${NFT_CONTRACT_ID}`);

    // Set up RPC server
    const server = new SorobanRpc.Server(RPC_URL);

    // Build the contract invocation
    const contract = new Contract(NFT_CONTRACT_ID);
    const account = await server.getAccount(adminAddress);

    const txBuilder = new TransactionBuilder(account, {
      fee: String(Number(BASE_FEE) * 100),
      networkPassphrase: NETWORK_PASSPHRASE,
    }).setTimeout(180);

    const mintOp = contract.call(
      "mint",
      Address.fromString(adminAddress).toScVal(), // admin
      Address.fromString(ownerAddress).toScVal(), // to
      nativeToScVal(numericPropertyId, { type: "u32" }), // property_id
      nativeToScVal(tokenUri, { type: "string" }), // token_uri
    );

    const txInitial = txBuilder.addOperation(mintOp).build();

    // Simulate first to get footprint & fees
    const simulation = await server.simulateTransaction(txInitial);
    if (SorobanRpc.Api.isSimulationError(simulation)) {
      console.error("[mint-property-nft] Simulation error:", simulation.error);
      return json({ error: `Simulation failed: ${simulation.error}` }, 500);
    }
    const simulatedReturnValue = simulation.result?.retval ?? null;

    // prepareTransaction assembles the real soroban resource fee from simulation
    const tx = await server.prepareTransaction(txInitial);
    tx.sign(adminKeypair);

    const result = await server.sendTransaction(tx);
    console.log(`[mint-property-nft] Transaction submitted: ${result.hash} status: ${result.status}`);

    if (result.status === "ERROR") {
      return json(
        { error: "Transaction submission failed", details: result },
        500,
      );
    }

    const finalResult = await waitForSorobanTransaction(
      server,
      result.hash,
      "mint",
      simulatedReturnValue,
    );
    const tokenId = finalResult.returnValue;

    if (typeof tokenId !== "number") {
      console.error("[mint-property-nft] Unexpected tokenId type:", typeof tokenId, tokenId);
      return json({ error: "Mint did not return a valid token ID" }, 500);
    }

    console.log(`[mint-property-nft] Successfully minted token #${tokenId}`);

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
