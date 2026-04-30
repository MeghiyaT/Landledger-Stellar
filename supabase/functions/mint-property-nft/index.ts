// Supabase Edge Function: mint-property-nft
// Signs the Soroban PropertyNFT.mint() call using the contract ADMIN key (deployer).
// The admin key is stored as a Supabase secret (STELLAR_DEPLOYER_SECRET).
// Called from the frontend after a property is successfully saved to the database.

import {
  Keypair,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  Contract,
  SorobanRpc,
  xdr,
} from "npm:@stellar/stellar-sdk@^13";

const NETWORK_PASSPHRASE = Networks.TESTNET;
const RPC_URL = "https://soroban-testnet.stellar.org";
const NFT_CONTRACT_ID =
  Deno.env.get("PROPERTY_NFT_CONTRACT_ID") ||
  "CDM2RBB2WBLXOUTATY6WFG55XNPLZMV75ILBVX27E2PFCUCF2K3VQMFG";
const POLL_INTERVAL_MS = 1500;
const MAX_TX_POLL_ATTEMPTS = 20;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function scValToNative(value: any) {
  if (!value) return null;

  switch (value.switch().name) {
    case "scvU32":
      return value.u32();
    case "scvString":
      return value.str().toString();
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
    try {
      const response = await server.getTransaction(hash);

      if (response.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        return {
          hash,
          returnValue: scValToNative(response.returnValue ?? fallbackReturnValue),
        };
      }

      if (response.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`Mint transaction failed on-chain for hash ${hash}`);
      }
    } catch (error) {
      console.warn("Falling back to raw RPC getTransaction:", error);
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
    }

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
    return new Response("ok", { headers: corsHeaders });
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
      fee: String(Number(BASE_FEE) * 10),
      networkPassphrase: NETWORK_PASSPHRASE,
    }).setTimeout(180);

    const mintOp = contract.call(
      "mint",
      nativeToScVal(adminAddress, { type: "address" }),       // admin
      nativeToScVal(ownerAddress, { type: "address" }),       // to
      nativeToScVal(numericPropertyId, { type: "u32" }),      // property_id
      nativeToScVal(tokenUri, { type: "string" }),            // token_uri
    );

    const txInitial = txBuilder.addOperation(mintOp).build();

    // Simulate first to get footprint & fees
    const simulation = await server.simulateTransaction(txInitial);
    if (SorobanRpc.Api.isSimulationError(simulation)) {
      return json({ error: `Simulation failed: ${simulation.error}` }, 500);
    }
    const simulatedReturnValue = simulation.result?.retval ?? null;

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
