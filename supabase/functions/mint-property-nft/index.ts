// Supabase Edge Function: mint-property-nft
// v4 — Uses @stellar/stellar-sdk@15 which supports the latest Soroban protocol XDR.
// Falls back to raw JSON-RPC for transaction polling to avoid any remaining decode issues.

import { Buffer } from "node:buffer";
import process from "node:process";

if (typeof globalThis.Buffer === "undefined") globalThis.Buffer = Buffer;
if (typeof globalThis.process === "undefined") globalThis.process = process;

// Use v15 — it knows the latest protocol XDR types (fixes "Bad union switch" errors)
const StellarSdk = await import("npm:@stellar/stellar-sdk@15.1.0");

// Log available exports for diagnostics
const sdkKeys = Object.keys(StellarSdk);
console.log("[mint-nft] SDK version: 15.1.0");
console.log("[mint-nft] SDK exports containing 'rpc' or 'Soroban':",
  sdkKeys.filter((k) => /rpc|soroban/i.test(k)),
);

// Destructure the universally available exports
const {
  Keypair,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  Contract,
  Address,
  nativeToScVal,
  xdr,
} = StellarSdk;

// Find the RPC module — v15 may export it as `rpc`, `SorobanRpc`, or both
const RpcModule = StellarSdk.rpc ?? StellarSdk.SorobanRpc ?? StellarSdk.Soroban;
let ServerClass: any = null;
let ApiModule: any = null;

if (RpcModule?.Server) {
  ServerClass = RpcModule.Server;
  ApiModule = RpcModule.Api ?? RpcModule;
  console.log("[mint-nft] Using SDK RPC module:", RpcModule === StellarSdk.rpc ? "rpc" : "SorobanRpc");
} else {
  // Last resort: try sub-path import
  try {
    const rpcSub = await import("npm:@stellar/stellar-sdk@15.1.0/rpc");
    ServerClass = rpcSub.Server ?? rpcSub.default?.Server;
    ApiModule = rpcSub.Api ?? rpcSub;
    console.log("[mint-nft] Using sub-path rpc import");
  } catch (e) {
    console.error("[mint-nft] Sub-path rpc import failed:", e);
  }
}

const NETWORK_PASSPHRASE = Networks.TESTNET;
const RPC_URL = "https://soroban-testnet.stellar.org";
const NFT_CONTRACT_ID = Deno.env.get("PROPERTY_NFT_CONTRACT_ID") || "CAFFJG3VLRHQ32AQZWXSEZXKSTKCUEM56UQS2AKKDHYOGAMRXK5ZJL5M";
const POLL_INTERVAL_MS = 1500;
const MAX_TX_POLL_ATTEMPTS = 20;
const FUNCTION_VERSION = "v4-2026-06-02";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Raw JSON-RPC helper (used for polling, which is most sensitive to XDR changes)
// ---------------------------------------------------------------------------
async function rawRpc(method: string, params: Record<string, unknown>) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const payload = await res.json();
  if (payload.error) {
    throw new Error(`RPC ${method}: ${payload.error.message || JSON.stringify(payload.error)}`);
  }
  return payload.result;
}

// ---------------------------------------------------------------------------
// Poll for u32 token ID via raw RPC (avoids TransactionMeta XDR decoding)
// ---------------------------------------------------------------------------
async function pollForTokenId(hash: string): Promise<number> {
  for (let i = 0; i < MAX_TX_POLL_ATTEMPTS; i++) {
    const result = await rawRpc("getTransaction", { hash });

    if (result.status === "SUCCESS") {
      // The return value (u32 token ID) is in result.returnValue as base64 ScVal
      if (result.returnValue) {
        try {
          const scVal = xdr.ScVal.fromXDR(result.returnValue, "base64");
          if (scVal.switch().name === "scvU32") return scVal.u32();
        } catch (e) {
          console.warn("[mint-nft] Could not decode returnValue:", e);
        }
      }

      // Fallback: check diagnostic events for fn_return
      for (const encoded of result.diagnosticEventsXdr ?? []) {
        try {
          const ev = xdr.DiagnosticEvent.fromXDR(encoded, "base64");
          const body = ev.event().body();
          const v0 = body.v0();
          const topics = v0.topics();
          if (
            topics.length >= 2 &&
            topics[0].switch().name === "scvSymbol" &&
            topics[0].sym().toString() === "fn_return" &&
            topics[1].switch().name === "scvSymbol" &&
            topics[1].sym().toString() === "mint"
          ) {
            const data = v0.data();
            if (data.switch().name === "scvU32") return data.u32();
          }
        } catch {
          continue; // Skip unparseable diagnostic events
        }
      }

      throw new Error("Mint succeeded but could not extract token ID from response");
    }

    if (result.status === "FAILED") {
      throw new Error(`Mint transaction failed on-chain: ${hash}`);
    }

    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Timed out waiting for mint transaction: ${hash}`);
}

// ---------------------------------------------------------------------------
// CORS headers
// ---------------------------------------------------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json("ok", 200);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { ownerAddress, propertyId, tokenUri } = await req.json();

    if (!ownerAddress || !propertyId || !tokenUri) {
      return json({ error: "Missing required fields: ownerAddress, propertyId, tokenUri" }, 400);
    }

    const deployerSecret = Deno.env.get("STELLAR_DEPLOYER_SECRET");
    if (!deployerSecret) {
      return json({ error: "Server misconfiguration: deployer secret not set" }, 500);
    }

    const adminKeypair = Keypair.fromSecret(deployerSecret);
    const adminAddress = adminKeypair.publicKey();

    const numericPropertyId = parseInt(propertyId, 10);
    if (isNaN(numericPropertyId) || numericPropertyId < 0) {
      return json({ error: "propertyId must be a valid non-negative integer" }, 400);
    }

    console.log(`[mint-nft ${FUNCTION_VERSION}] property #${numericPropertyId} → ${ownerAddress}`);

    // -------------------------------------------------------------------
    // Check if token already exists (Idempotency)
    // -------------------------------------------------------------------
    try {
      const horizonResp = await fetch(`https://horizon-testnet.stellar.org/accounts/${adminAddress}`);
      if (horizonResp.ok) {
        const { sequence } = await horizonResp.json();
        const { Account } = StellarSdk;
        const account = new Account(adminAddress, sequence);
        
        const contract = new Contract(NFT_CONTRACT_ID);
        const checkOp = contract.call(
          "has_token",
          nativeToScVal(numericPropertyId, { type: "u32" })
        );
        const txCheck = new TransactionBuilder(account, {
          fee: String(Number(BASE_FEE) * 100),
          networkPassphrase: NETWORK_PASSPHRASE,
        }).addOperation(checkOp).setTimeout(180).build();
        
        const simResult = await rawRpc("simulateTransaction", { transaction: txCheck.toXDR() });
        if (simResult.results && simResult.results.length > 0) {
          const scVal = xdr.ScVal.fromXDR(simResult.results[0].xdr, "base64");
          if (scVal.switch().name === "scvBool" && scVal.b() === true) {
            console.log(`[mint-nft] Property #${numericPropertyId} already has a token. Fetching token ID...`);
            const getOp = contract.call(
              "get_token_by_property",
              nativeToScVal(numericPropertyId, { type: "u32" })
            );
            const txGet = new TransactionBuilder(account, {
              fee: String(Number(BASE_FEE) * 100),
              networkPassphrase: NETWORK_PASSPHRASE,
            }).addOperation(getOp).setTimeout(180).build();
            const simResult2 = await rawRpc("simulateTransaction", { transaction: txGet.toXDR() });
            
            if (simResult2.results && simResult2.results.length > 0) {
              const scVal2 = xdr.ScVal.fromXDR(simResult2.results[0].xdr, "base64");
              if (scVal2.switch().name === "scvU32") {
                const existingTokenId = scVal2.u32();
                console.log(`[mint-nft] Returning existing token #${existingTokenId} for property #${numericPropertyId}`);
                return json({
                  success: true,
                  txHash: "already-minted",
                  tokenId: existingTokenId.toString(),
                  contractId: NFT_CONTRACT_ID,
                  admin: adminAddress,
                  owner: ownerAddress,
                  functionVersion: FUNCTION_VERSION,
                });
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("[mint-nft] Warning: failed to check for existing token", e);
    }

    // -------------------------------------------------------------------
    // Build the mint transaction
    // -------------------------------------------------------------------
    const contract = new Contract(NFT_CONTRACT_ID);
    const mintOp = contract.call(
      "mint",
      Address.fromString(adminAddress).toScVal(),
      Address.fromString(ownerAddress).toScVal(),
      nativeToScVal(numericPropertyId, { type: "u32" }),
      nativeToScVal(tokenUri, { type: "string" }),
    );

    // -------------------------------------------------------------------
    // Strategy A: Use the SDK's RPC Server (v15 handles new protocol XDR)
    // -------------------------------------------------------------------
    if (ServerClass) {
      console.log("[mint-nft] Using SDK Server for simulate + prepare + submit");

      const server = new ServerClass(RPC_URL);
      const account = await server.getAccount(adminAddress);

      const txInitial = new TransactionBuilder(account, {
        fee: String(Number(BASE_FEE) * 100),
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(mintOp)
        .setTimeout(180)
        .build();

      // Simulate
      const simulation = await server.simulateTransaction(txInitial);
      const isSimError = ApiModule?.isSimulationError?.(simulation) ??
        (simulation as any).error != null;
      if (isSimError) {
        const errMsg = (simulation as any).error ?? "Unknown simulation error";
        console.error("[mint-nft] Simulation failed:", errMsg);
        return json({ error: `Simulation failed: ${JSON.stringify(errMsg)}` }, 500);
      }

      // Prepare (injects sorobanData + auth + fee from simulation)
      const tx = await server.prepareTransaction(txInitial);
      tx.sign(adminKeypair);

      // Submit
      const submitResult = await server.sendTransaction(tx);
      console.log(`[mint-nft] Submitted: ${submitResult.hash} status: ${submitResult.status}`);

      if (submitResult.status === "ERROR") {
        return json({ error: "Transaction submission failed", details: submitResult }, 500);
      }

      // Poll via raw RPC (avoids TransactionMeta decode issues)
      const tokenId = await pollForTokenId(submitResult.hash);
      console.log(`[mint-nft] Minted token #${tokenId}`);

      return json({
        success: true,
        txHash: submitResult.hash,
        tokenId: tokenId.toString(),
        contractId: NFT_CONTRACT_ID,
        admin: adminAddress,
        owner: ownerAddress,
        functionVersion: FUNCTION_VERSION,
      });
    }

    // -------------------------------------------------------------------
    // Strategy B: Full raw JSON-RPC (if SDK Server class not available)
    // -------------------------------------------------------------------
    console.log("[mint-nft] SDK Server not available — using full raw RPC");

    // Get account sequence from Horizon
    const horizonResp = await fetch(
      `https://horizon-testnet.stellar.org/accounts/${adminAddress}`,
    );
    if (!horizonResp.ok) {
      return json({ error: `Could not load admin account from Horizon` }, 500);
    }
    const { sequence } = await horizonResp.json();

    // Build initial tx
    const { Account } = StellarSdk;
    const account = new Account(adminAddress, sequence);
    const txInitial = new TransactionBuilder(account, {
      fee: String(Number(BASE_FEE) * 100),
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(mintOp)
      .setTimeout(180)
      .build();

    // Simulate via raw RPC
    const simResult = await rawRpc("simulateTransaction", {
      transaction: txInitial.toXDR(),
    });

    if (simResult.error) {
      return json({ error: `Simulation failed: ${JSON.stringify(simResult.error)}` }, 500);
    }
    if (!simResult.transactionData) {
      return json({ error: "Simulation returned no transactionData" }, 500);
    }

    // Assemble: set sorobanData + auth + fee on a fresh tx
    // Use the SDK's assembleTransaction if available
    const assembleTransaction =
      RpcModule?.assembleTransaction ??
      StellarSdk.SorobanRpc?.assembleTransaction ??
      StellarSdk.rpc?.assembleTransaction;

    if (assembleTransaction) {
      console.log("[mint-nft] Using assembleTransaction helper");
      const assembled = assembleTransaction(txInitial, simResult);
      assembled.sign(adminKeypair);

      const submitResult = await rawRpc("sendTransaction", {
        transaction: assembled.toXDR(),
      });

      if (submitResult.status === "ERROR") {
        return json({ error: "Transaction submission failed" }, 500);
      }

      const tokenId = await pollForTokenId(submitResult.hash);
      return json({
        success: true,
        txHash: submitResult.hash,
        tokenId: tokenId.toString(),
        contractId: NFT_CONTRACT_ID,
        admin: adminAddress,
        owner: ownerAddress,
        functionVersion: FUNCTION_VERSION,
      });
    }

    // Last resort: manual assembly using raw XDR bytes
    console.log("[mint-nft] Manual transaction assembly");

    const sorobanData = xdr.SorobanTransactionData.fromXDR(
      simResult.transactionData,
      "base64",
    );
    const minFee = parseInt(simResult.minResourceFee || "0", 10);
    const totalFee = Number(BASE_FEE) * 100 + minFee;

    const account2 = new Account(adminAddress, String(BigInt(sequence)));

    // Rebuild the operation with auth from simulation
    const authEntries = (simResult.results?.[0]?.auth ?? []).map(
      (a: string) => xdr.SorobanAuthorizationEntry.fromXDR(a, "base64"),
    );
    const invokeOp = contract.call(
      "mint",
      Address.fromString(adminAddress).toScVal(),
      Address.fromString(ownerAddress).toScVal(),
      nativeToScVal(numericPropertyId, { type: "u32" }),
      nativeToScVal(tokenUri, { type: "string" }),
    );

    const finalTx = new TransactionBuilder(account2, {
      fee: totalFee.toString(),
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(invokeOp)
      .setTimeout(180)
      .setSorobanData(sorobanData)
      .build();

    // Inject auth entries into the operation
    const ops = finalTx.operations;
    if (ops.length > 0 && authEntries.length > 0) {
      (ops[0] as any).auth = authEntries;
    }

    finalTx.sign(adminKeypair);

    const submitResult = await rawRpc("sendTransaction", {
      transaction: finalTx.toXDR(),
    });

    if (submitResult.status === "ERROR") {
      return json({ error: "Transaction submission failed" }, 500);
    }

    const tokenId = await pollForTokenId(submitResult.hash);
    return json({
      success: true,
      txHash: submitResult.hash,
      tokenId: tokenId.toString(),
      contractId: NFT_CONTRACT_ID,
      admin: adminAddress,
      owner: ownerAddress,
      functionVersion: FUNCTION_VERSION,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : "";
    console.error(`[mint-nft ${FUNCTION_VERSION}] FATAL:`, message);
    if (stack) console.error(stack);
    return json({ error: message, functionVersion: FUNCTION_VERSION }, 500);
  }
});
