import { Contract, rpc, nativeToScVal, Address, TransactionBuilder, Account, Networks, Keypair, xdr } from '@stellar/stellar-sdk'
import dotenv from 'dotenv'
dotenv.config()

const server = new rpc.Server('https://soroban-testnet.stellar.org')
const contract = new Contract('CDM2RBB2WBLXOUTATY6WFG55XNPLZMV75ILBVX27E2PFCUCF2K3VQMFG')
const keypair = Keypair.fromSecret(process.env.PRIVATE_KEY)

async function run() {
  try {
    const adminAddress = keypair.publicKey()
    const { sequence } = await (await fetch(`https://horizon-testnet.stellar.org/accounts/${adminAddress}`)).json()
    const account = new Account(adminAddress, sequence)

    const tx = new TransactionBuilder(account, { fee: "1000", networkPassphrase: Networks.TESTNET })
      .addOperation(contract.call('init', new Address(adminAddress).toScVal()))
      .setTimeout(30)
      .build()
    
    const simResult = await server.simulateTransaction(tx)
    if (simResult.error) {
      console.log('Error simulating init:', simResult.error)
    } else {
      console.log('Init simulated successfully!')
      console.log(JSON.stringify(simResult, null, 2))
    }
  } catch (e) {
    console.log('Catch Error:', e.message)
  }
}
run()
