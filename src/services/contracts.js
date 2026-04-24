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
    PropertyRegistry: import.meta.env.VITE_PROPERTY_REGISTRY_ADDRESS,
    PropertyNFT: import.meta.env.VITE_PROPERTY_NFT_ADDRESS,
    PropertyToken: import.meta.env.VITE_PROPERTY_TOKEN_ADDRESS,
    Escrow: import.meta.env.VITE_ESCROW_ADDRESS,
    PropertyOffers: import.meta.env.VITE_PROPERTY_OFFERS_ADDRESS,
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

  // Soroban calls must go through simulateTransaction first
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build()

  const xdr = tx.toXDR()
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
    StellarSdk.nativeToScVal(publicKey, { type: 'address' }),
    StellarSdk.nativeToScVal(title, { type: 'string' }),
    StellarSdk.nativeToScVal(location, { type: 'string' }),
    StellarSdk.nativeToScVal(BigInt(price), { type: 'u128' }),
  ])

  return { txHash: result.hash, propertyId: 'ledger-confirmed' }
}

export const transferPropertyOwnership = async (propertyId, newOwner) => {
  const { PropertyRegistry } = getContractAddresses()
  
  return await invokeSoroban(PropertyRegistry, 'transfer_ownership', [
    StellarSdk.nativeToScVal(parseInt(propertyId), { type: 'u32' }),
    StellarSdk.nativeToScVal(newOwner, { type: 'address' }),
  ])
}

export const listPropertyForSale = async (propertyId, price) => {
  const { PropertyRegistry } = getContractAddresses()
  
  return await invokeSoroban(PropertyRegistry, 'list_for_sale', [
    StellarSdk.nativeToScVal(parseInt(propertyId), { type: 'u32' }),
    StellarSdk.nativeToScVal(BigInt(price), { type: 'u128' }),
  ])
}

// --- Escrow Service ---

export const createEscrowXLM = async (propertyId, seller, amount, deadline) => {
  const { Escrow, PropertyToken } = getContractAddresses()
  const publicKey = await getPublicKey()

  // Soroban args: buyer (Address), property_id (u32), seller (Address), token (Address), amount (u128), deadline (u64)
  return await invokeSoroban(Escrow, 'create_escrow', [
    StellarSdk.nativeToScVal(publicKey, { type: 'address' }),
    StellarSdk.nativeToScVal(parseInt(propertyId), { type: 'u32' }),
    StellarSdk.nativeToScVal(seller, { type: 'address' }),
    StellarSdk.nativeToScVal(PropertyToken, { type: 'address' }),
    StellarSdk.nativeToScVal(BigInt(amount), { type: 'u128' }),
    StellarSdk.nativeToScVal(parseInt(deadline), { type: 'u64' }),
  ])
}

export const completeEscrowOnChain = async (transactionId) => {
  const { Escrow } = getContractAddresses()
  const publicKey = await getPublicKey()

  return await invokeSoroban(Escrow, 'complete_escrow', [
    StellarSdk.nativeToScVal(parseInt(transactionId), { type: 'u32' }),
    StellarSdk.nativeToScVal(publicKey, { type: 'address' }),
  ])
}

// --- PropertyNFT Service ---
export const mintPropertyNFT = async (ownerAddress, propertyId, tokenUri) => {
  const { PropertyNFT } = getContractAddresses()
  
  const result = await invokeSoroban(PropertyNFT, 'mint', [
    StellarSdk.nativeToScVal(ownerAddress, { type: 'address' }),
    StellarSdk.nativeToScVal(parseInt(propertyId), { type: 'u32' }),
    StellarSdk.nativeToScVal(tokenUri, { type: 'string' })
  ])
  
  return { txHash: result.hash, tokenId: propertyId }
}

export const hasPropertyNFT = async (propertyId) => {
  return false; // Implement RPC read
}

// Simple legacy placeholders for parts of the UI not yet fully migrated
export const getPropertyOnChain = async () => ({})
export const getPropertyTokenBalance = async () => '0'
export const getPropertyOwnershipHistory = async () => []
