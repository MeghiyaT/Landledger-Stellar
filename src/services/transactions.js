import { supabase } from '../lib/supabase'
import { completeEscrowOnChain } from './contracts'
import { notifyTransactionCompleted } from './notifications'
import * as StellarSdk from '@stellar/stellar-sdk'

const HORIZON_URL = 'https://horizon-testnet.stellar.org'

export const getTransactions = async (userId, filters = {}) => {
  let query = supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  if (filters.type && filters.type !== 'all') {
    query = query.eq('transaction_type', filters.type)
  }

  query = query.order('created_at', { ascending: false })

  if (filters.limit) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query

  // Fetch Stellar transactions if wallet address is available
  let blockchainTransactions = []
  if (!error && userId) {
    try {
      const { supabaseStorage } = await import('../lib/supabaseStorage')
      const { data: profile } = await supabaseStorage
        .from('profiles')
        .select('wallet_address')
        .eq('id', userId)
        .single()

      if (profile?.wallet_address) {
        const { data: stellarTxs } = await getBlockchainTransactions(profile.wallet_address)
        blockchainTransactions = (stellarTxs || []).map(tx => ({
          ...tx,
          user_id: userId
        }))
      }
    } catch (blockchainErr) {
      console.error('Error fetching Stellar transactions:', blockchainErr)
    }
  }

  let allTransactions = data || []
  if (blockchainTransactions.length > 0) {
    const existingTxHashes = new Set(
      (data || [])
        .filter(tx => tx.blockchain_tx_hash)
        .map(tx => tx.blockchain_tx_hash.toLowerCase())
    )

    const uniqueBlockchainTxs = blockchainTransactions.filter(
      tx => !existingTxHashes.has(tx.blockchain_tx_hash?.toLowerCase() || '')
    )

    allTransactions = [...(data || []), ...uniqueBlockchainTxs]
    allTransactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }

  return { data: allTransactions, error }
}

export const createTransaction = async (transactionData) => {
  const { data, error } = await supabase
    .from('transactions')
    .insert(transactionData)
    .select()
    .single()

  return { data, error }
}

export const updateTransactionStatus = async (transactionId, status, userId) => {
  const { data: transaction, error: fetchError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .single()

  if (fetchError || !transaction) {
    return { data: null, error: fetchError || { message: 'Transaction not found' } }
  }

  if (transaction.user_id !== userId) {
    return { data: null, error: { message: 'You can only update your own transactions' } }
  }

  // Trigger Soroban Escrow Completion if applicable
  if (status === 'completed' && transaction.metadata?.escrow_transaction_id) {
    try {
      await completeEscrowOnChain(transaction.metadata.escrow_transaction_id)
    } catch (escrowError) {
      console.error('Failed to complete Soroban escrow:', escrowError)
      return { data: null, error: { message: 'Blockchain escrow completion failed.' } }
    }
  }

  const { data, error } = await supabase
    .from('transactions')
    .update({ 
      status,
      updated_at: new Date().toISOString()
    })
    .eq('id', transactionId)
    .select()
    .single()

  return { data, error }
}

/**
 * Fetch transaction history from Stellar Horizon
 */
export const getBlockchainTransactions = async (walletAddress) => {
  if (!walletAddress) return { data: [], error: null }

  try {
    const server = new StellarSdk.Horizon.Server(HORIZON_URL)
    const payments = await server.payments().forAccount(walletAddress).limit(15).order('desc').call()
    
    const transactions = payments.records.map(record => ({
      id: `stellar-${record.transaction_hash}`,
      transaction_type: record.to === walletAddress ? 'purchase' : 'sale',
      amount: record.amount,
      currency: 'XLM',
      status: 'completed',
      description: `Stellar payment ${record.to === walletAddress ? 'received' : 'sent'}`,
      blockchain_tx_hash: record.transaction_hash,
      created_at: record.created_at,
      metadata: {
        from: record.from,
        to: record.to,
        asset: 'native'
      }
    }))

    return { data: transactions, error: null }
  } catch (err) {
    console.error('Error fetching Stellar payments:', err)
    return { data: [], error: err }
  }
}

export const verifyBlockchainTransaction = async (txHash) => {
  try {
    const server = new StellarSdk.Horizon.Server(HORIZON_URL)
    const tx = await server.transactions().transaction(txHash).call()
    return { data: tx, error: null }
  } catch (error) {
    return { data: null, error }
  }
}
