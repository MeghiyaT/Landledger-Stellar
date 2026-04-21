import * as StellarSdk from '@stellar/stellar-sdk'
import {
  signTransaction,
  getPublicKey,
} from '@stellar/freighter-api'

const HORIZON_URL = 'https://horizon-testnet.stellar.org'
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET

/**
 * Get contract IDs from environment variables
 */
export const getContractAddresses = () => {
  return {
    PropertyRegistry: import.meta.env.VITE_SOROBAN_REGISTRY_ID,
    Escrow: import.meta.env.VITE_SOROBAN_ESCROW_ID,
    XLM_ASSET: 'native',
  }
}

/**
 * Helper to invoke a Soroban contract method
 */
const invokeSoroban = async (contractId, method, args = []) => {
  const publicKey = await getPublicKey()
  const server = new StellarSdk.Horizon.Server(HORIZON_URL)
  const account = await server.loadAccount(publicKey)
  const contract = new StellarSdk.Contract(contractId)

  const transaction = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(method, ...args)
    )
    .setTimeout(30)
    .build()

  const xdr = transaction.toXDR()
  const signedXdr = await signTransaction(xdr, { network: 'TESTNET' })
  
  const result = await server.submitTransaction(
    StellarSdk.TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)
  )
  return result
}

// --- PropertyRegistry Service ---

export const registerPropertyOnChain = async (title, location, price) => {
  const { PropertyRegistry } = getContractAddresses()
  const publicKey = await getPublicKey()

  // Soroban args: owner (Address), title (String), location (String), price (u128)
  const result = await invokeSoroban(PropertyRegistry, 'register_property', [
    StellarSdk.Address.fromString(publicKey),
    new StellarSdk.ScVal.scvString(title),
    new StellarSdk.ScVal.scvString(location),
    StellarSdk.nativeToScVal(price, { type: 'u128' }),
  ])

  return { txHash: result.hash, propertyId: 'ledger-confirmed' }
}

export const transferPropertyOwnership = async (propertyId, newOwner) => {
  const { PropertyRegistry } = getContractAddresses()
  
  return await invokeSoroban(PropertyRegistry, 'transfer_ownership', [
    StellarSdk.nativeToScVal(parseInt(propertyId), { type: 'u32' }),
    StellarSdk.Address.fromString(newOwner),
  ])
}

export const listPropertyForSale = async (propertyId, price) => {
  const { PropertyRegistry } = getContractAddresses()
  
  return await invokeSoroban(PropertyRegistry, 'list_for_sale', [
    StellarSdk.nativeToScVal(parseInt(propertyId), { type: 'u32' }),
    StellarSdk.nativeToScVal(price, { type: 'u128' }),
  ])
}

// --- Escrow Service ---

export const createEscrowXLM = async (propertyId, seller, amount, deadline) => {
  const { Escrow } = getContractAddresses()
  const publicKey = await getPublicKey()

  // Soroban args: buyer (Address), property_id (u32), seller (Address), token (Address), amount (u128), deadline (u64)
  return await invokeSoroban(Escrow, 'create_escrow', [
    StellarSdk.Address.fromString(publicKey),
    StellarSdk.nativeToScVal(parseInt(propertyId), { type: 'u32' }),
    StellarSdk.Address.fromString(seller),
    StellarSdk.Address.fromString('CDLZFC3SYJYDZT7K67VZ75HXZS65IR6HMDM7S7YNDXGSRW7PVD6S7S6S'), // Dummy native token addr or similar
    StellarSdk.nativeToScVal(amount, { type: 'u128' }),
    StellarSdk.nativeToScVal(deadline, { type: 'u64' }),
  ])
}

export const completeEscrowOnChain = async (transactionId) => {
  const { Escrow } = getContractAddresses()
  const publicKey = await getPublicKey()

  return await invokeSoroban(Escrow, 'complete_escrow', [
    StellarSdk.nativeToScVal(parseInt(transactionId), { type: 'u32' }),
    StellarSdk.Address.fromString(publicKey),
  ])
}

// Simple legacy placeholders for parts of the UI not yet fully migrated
export const getPropertyOnChain = async () => ({})
export const getPropertyTokenBalance = async () => '0'
export const getPropertyOwnershipHistory = async () => []
export const mintPropertyNFT = async () => ({ txHash: '0x0' })
export const hasPropertyNFT = async () => false
