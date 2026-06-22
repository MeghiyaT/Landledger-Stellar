const { Contract, Address, nativeToScVal, rpc, TransactionBuilder, Networks, Keypair, xdr } = require('@stellar/stellar-sdk');
const RPC_URL = 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

async function main() {
  const server = new rpc.Server(RPC_URL);
  
  // Wallet to simulate as
  const sellerWallet = 'GAXGKGUCE7O5SYJHYYFMCP4DT5TEWHUPVKPGL2ZFXNJ2UG7MYYD7DFDX';
  // I don't have the secret, but I can use an arbitrary keypair for the fee bump or just build it with any account, 
  // but to simulate auth, we need to sign the auth payload. Actually, simulation doesn't require actual signatures!
  
  const account = await server.getAccount(sellerWallet);
  
  const PropertyRegistry = new Contract('CCDDNGBJDZRLD6JU44QSMBWDPN6W6TIRDH57ZRXTTYCL63RWX3XLBE7C');
  const EscrowAddress = 'CA3BNTMSOVRAWKM4HDVWULA3RNEYSUYIZ6FEJ3FSCA45EFWFIGS27YNZ';
  const propertyId = 14;

  const registryApproveOp = PropertyRegistry.call(
    'approve',
    nativeToScVal(propertyId, { type: 'u32' }),
    nativeToScVal(EscrowAddress, { type: 'address' })
  );
  
  const tx1 = new TransactionBuilder(account, {
    fee: "1000",
    networkPassphrase: NETWORK_PASSPHRASE
  }).addOperation(registryApproveOp).setTimeout(180).build();

  console.log("Simulating Step 1 (Registry Approve)...");
  const sim1 = await server.simulateTransaction(tx1);
  if (sim1.error) {
    console.error("Step 1 failed:", sim1.error);
    if (sim1.events) console.error("Events:", sim1.events);
  } else {
    console.log("Step 1 Success!");
  }

  const PropertyNFT = new Contract('CDHIORQCQCT25VUOBVUCYKWGNOORJOTWZ5G2PYG2Y5AYG66HLI4FDQFF');
  const buyerWallet = 'GBVIFG3KKOGRZ65J72WYBAK3KBKHPIFNH332MWH753JSTMXBJGXEOLZX';
  const nftTokenId = 3;
  const ledgerExpiry = 3737675 + 1000;

  const nftApproveOp = PropertyNFT.call(
    'approve',
    nativeToScVal(sellerWallet, { type: 'address' }),
    nativeToScVal(buyerWallet, { type: 'address' }),
    nativeToScVal(nftTokenId, { type: 'u32' }),
    nativeToScVal(ledgerExpiry, { type: 'u32' })
  );

  const tx2 = new TransactionBuilder(account, {
    fee: "1000",
    networkPassphrase: NETWORK_PASSPHRASE
  }).addOperation(nftApproveOp).setTimeout(180).build();

  console.log("\nSimulating Step 2 (NFT Approve)...");
  const sim2 = await server.simulateTransaction(tx2);
  if (sim2.error) {
    console.error("Step 2 failed:", sim2.error);
    // Parse the events to see any WasmVm panic
    if (sim2.events) {
      sim2.events.forEach((evt, i) => {
        if (evt.topic) {
           console.log(`Event ${i} topic:`, evt.topic.map(t => t.value ? xdr.ScVal.fromXDR(t.value, 'base64').switch().name : t));
        }
      });
    }
  } else {
    console.log("Step 2 Success!");
  }
}

main().catch(console.error);
