import { Contract, rpc, nativeToScVal, scValToNative, TransactionBuilder, Account, Networks } from '@stellar/stellar-sdk'
const server = new rpc.Server('https://soroban-testnet.stellar.org')
const contract = new Contract('CDM2RBB2WBLXOUTATY6WFG55XNPLZMV75ILBVX27E2PFCUCF2K3VQMFG')
async function run() {
  try {
    const account = new Account('GAXGKGUCE7O5SYJHYYFMCP4DT5TEWHUPVKPGL2ZFXNJ2UG7MYYD7DFDX', "0")
    const tx = new TransactionBuilder(account, { fee: "100", networkPassphrase: Networks.TESTNET })
      .addOperation(contract.call('owner_of', nativeToScVal(4, {type: 'u32'})))
      .setTimeout(30)
      .build()
    
    const simResult = await server.simulateTransaction(tx)
    if (simResult.results && simResult.results[0] && simResult.results[0].xdr) {
      console.log('Owner:', scValToNative(simResult.results[0].xdr))
    } else {
      console.log('Error simulating owner_of:', simResult.error || JSON.stringify(simResult.events, null, 2))
    }
  } catch (e) {
    console.log('Catch Error:', e.message)
  }
}
run()
