import { rpc, Contract, nativeToScVal, scValToNative, TransactionBuilder } from '@stellar/stellar-sdk';
const server = new rpc.Server('https://soroban-testnet.stellar.org');
const contract = new Contract('CDM2RBB2WBLXOUTATY6WFG55XNPLZMV75ILBVX27E2PFCUCF2K3VQMFG');
async function query() {
  try {
    const tx = contract.call('owner_of', nativeToScVal(4, { type: 'u32' }));
    const sim = await server.simulateTransaction(
      new TransactionBuilder(
        await server.getAccount('GAXGKGUCE7O5SYJHYYFMCP4DT5TEWHUPVKPGL2ZFXNJ2UG7MYYD7DFDX'),
        { fee: '100', networkPassphrase: 'Test SDF Network ; September 2015' }
      ).addOperation(tx).setTimeout(30).build()
    );
    console.log(JSON.stringify(sim, null, 2));
  } catch (e) {
    console.error(e);
  }
}
query();
