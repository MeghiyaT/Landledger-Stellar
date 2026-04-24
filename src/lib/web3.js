import * as StellarSdk from '@stellar/stellar-sdk'
import {
  isConnected,
  isAllowed,
  getAddress,
  getNetwork,
  signTransaction,
} from '@stellar/freighter-api'

// Stellar Testnet Configuration
export const HORIZON_URL = 'https://horizon-testnet.stellar.org'
export const STELLAR_NETWORK = 'TESTNET'

/**
 * Check if Freighter is installed (Replaces Freighter check)
 * @returns {boolean}
 */
export const isFreighterInstalled = async () => {
  try {
    const { isConnected: connected } = await isConnected()
    return connected
  } catch (error) {
    return false
  }
}

/**
 * Check if the current network is Stellar Testnet
 * @returns {Promise<boolean>}
 */
export const isTestnetNetwork = async () => {
  if (!(await isFreighterInstalled())) {
    return false
  }

  try {
    const { network } = await getNetwork()
    return network === 'TESTNET'
  } catch (error) {
    console.error('Error checking network:', error)
    return false
  }
}

/**
 * Placeholder for network switching (Freighter doesn't support programmatic switching yet)
 */
export const switchToStellarTestnet = async () => {
  if (!(await isFreighterInstalled())) {
    throw new Error('Freighter wallet is not installed')
  }
  throw new Error('Please manually switch to TESTNET in your Freighter settings.')
}

/**
 * Get XLM balance for a Stellar address
 * @param {string} address - Stellar public key
 * @returns {Promise<string>} Balance in XLM
 */
export const getBalance = async (address) => {
  try {
    const server = new StellarSdk.Horizon.Server(HORIZON_URL)
    const account = await server.loadAccount(address)
    const nativeBalance = account.balances.find((b) => b.asset_type === 'native')
    return nativeBalance ? nativeBalance.balance : '0.0000000'
  } catch (error) {
    console.error('Error getting XLM balance:', error)
    return '0.0000000'
  }
}

/**
 * Send a native XLM transaction
 * @param {string} toAddress - Recipient public key
 * @param {string|number} amountInXlm - Amount in XLM
 * @returns {Promise<string>} Transaction hash
 */
export const sendTransaction = async (toAddress, amountInXlm) => {
  if (!(await isAllowed())) {
    throw new Error('Freighter access not allowed')
  }

  const { address: senderAddress } = await getAddress()
  const server = new StellarSdk.Horizon.Server(HORIZON_URL)
  const account = await server.loadAccount(senderAddress)

  const transaction = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: toAddress,
        asset: StellarSdk.Asset.native(),
        amount: amountInXlm.toString(),
      })
    )
    .setTimeout(30)
    .build()

  const signedTx = await signTransaction(transaction.toXDR(), {
    network: 'TESTNET',
  })

  const result = await server.submitTransaction(
    StellarSdk.TransactionBuilder.fromXDR(signedTx, StellarSdk.Networks.TESTNET)
  )
  return result.hash
}

/**
 * Format XLM amount for display
 * @param {string|number} amount 
 * @returns {string} 
 */
export const formatEth = (amount) => {
  return parseFloat(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  })
}

// Minimal placeholder exports to satisfy existing imports until we refactor them
export const getSigner = async () => ({})
export const getContract = async () => ({})
export const getContractReadOnly = async () => ({})
export const waitForTransaction = async (hash) => {
  const server = new StellarSdk.Horizon.Server(HORIZON_URL)
  return await server.operations().forTransaction(hash).call()
}
export const getTransactionReceipt = async (hash) => {
  const server = new StellarSdk.Horizon.Server(HORIZON_URL)
  return await server.transactions().transaction(hash).call()
}
