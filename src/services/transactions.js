import { supabase } from '../lib/supabase'
import { _completeEscrowOnChain, cancelEscrowOnChain, _transferPropertyNFT, completeEscrowAndTransferNFT } from './contracts'
import * as StellarSdk from '@stellar/stellar-sdk'
import { notifyPropertySold, notifyPropertyPurchased } from './notifications'
import { getWalletAddresses } from './user'

const HORIZON_URL = 'https://horizon-testnet.stellar.org'

export const getTransactions = async (userId, filters = {}) => {
  let query = supabase
    .from('transactions')
    .select(`
      *,
      properties (
        id,
        nft_token_id,
        nft_transfer_tx_hash,
        sold_to,
        user_id
      )
    `)
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

  const allTransactions = data || []

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

  // nftTransferHash is populated inside the completed escrow batch block below.
  // Declared here so all branches of the escrow try/catch can write to it.
  let nftTransferHash = null

  // Trigger Soroban Escrow Completion or Cancellation if applicable
  if (transaction.metadata?.escrow_transaction_id) {
    try {
      if (status === 'completed') {
        // ------------------------------------------------------------------
        // Resolve NFT details upfront so we can batch escrow + NFT transfer
        // into ONE Freighter popup instead of two sequential ones.
        // ------------------------------------------------------------------
        let nftTokenId = null
        let sellerWallet = transaction.metadata?.seller_wallet
        let buyerWallet  = transaction.metadata?.buyer_wallet

        if (transaction.property_id) {
          const { data: propForBatch } = await supabase
            .from('properties')
            .select('nft_token_id, nft_transfer_tx_hash')
            .eq('id', transaction.property_id)
            .single()

          // Only include the NFT op when there is a token that hasn't been transferred yet
          if (propForBatch?.nft_token_id && !propForBatch?.nft_transfer_tx_hash) {
            nftTokenId = propForBatch.nft_token_id

            if (!sellerWallet || !buyerWallet) {
              const { data: walletData, error: walletError } = await getWalletAddresses([
                transaction.metadata?.seller_id,
                transaction.metadata?.buyer_id,
              ])
              if (walletError) {
                return { data: null, error: { message: 'Unable to resolve wallet addresses for NFT transfer.' } }
              }
              sellerWallet = sellerWallet || walletData?.[transaction.metadata?.seller_id]
              buyerWallet  = buyerWallet  || walletData?.[transaction.metadata?.buyer_id]
            }

            if (!sellerWallet || !buyerWallet) {
              return { data: null, error: { message: 'Missing seller or buyer wallet address for NFT transfer.' } }
            }
          }
        }

        // Single Freighter popup: completes escrow AND transfers NFT deed atomically
        // (callerAddress is resolved internally by completeEscrowAndTransferNFT)
        const batchResult = await completeEscrowAndTransferNFT(
          transaction.metadata.escrow_transaction_id,
          nftTokenId,
          sellerWallet,
          buyerWallet
        )

        // Store the NFT transfer hash for downstream Supabase sync
        if (batchResult.nftHash) {
          nftTransferHash = batchResult.nftHash
        }
      } else if (status === 'failed') {
        await cancelEscrowOnChain(transaction.metadata.escrow_transaction_id)
      }
    } catch (escrowError) {
      console.error(`Failed to handle Soroban escrow (${status}):`, escrowError)
      
      let friendlyMessage = `Blockchain escrow ${status === 'completed' ? 'completion' : 'cancellation'} failed. Please try again.`
      
      const msg = escrowError.message || ''

      if (msg.includes('Auth') && msg.includes('InvalidAction')) {
        // Cross-contract auth failure: seller never called approve() on the registry
        friendlyMessage = status === 'completed'
          ? "The seller has not yet authorized this transfer on-chain. Please ask the seller to re-accept the offer with their Freighter wallet connected so the approval can be signed."
          : "Authorization failed. You may not have permission to cancel this escrow."
      } else if (msg.includes('WasmVm') && msg.includes('InvalidAction') || msg.includes('UnreachableCodeReached')) {
        // Smart contract panic — typically the deadline check for cancel
        friendlyMessage = status === 'failed'
          ? "Cannot cancel yet: the escrow time-lock deadline has not expired. You can only request a refund after the deadline shown on your transaction."
          : "The smart contract rejected this action. Please check that all conditions are met."
      } else if (msg.includes('Transaction expired') || msg.includes('deadline')) {
        friendlyMessage = "The escrow has expired. Please contact support to resolve this transaction."
      } else if (msg.includes('Transaction closed')) {
        friendlyMessage = status === 'completed'
          ? "This escrow was already completed on-chain. Finishing the ownership sync now may still be possible if the NFT transfer has not been recorded yet."
          : "This escrow has already been completed or cancelled."
      }

      const isRetryableCompletion = status === 'completed' && msg.includes('Transaction closed')
      if (!isRetryableCompletion) {
        return { data: null, error: { message: friendlyMessage } }
      }
    }
  }

  // If no escrow existed, or the NFT was already transferred in a prior call,
  // fall back to fetching the existing hash from Supabase.
  if (status === 'completed' && transaction.transaction_type === 'purchase' && transaction.property_id && !nftTransferHash) {
    const { data: property } = await supabase
      .from('properties')
      .select('nft_transfer_tx_hash')
      .eq('id', transaction.property_id)
      .single()
    nftTransferHash = property?.nft_transfer_tx_hash || null
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

  // When buyer releases funds (completed), mark the property as officially 'sold'
  if (!error && status === 'completed' && transaction.property_id && transaction.transaction_type === 'purchase') {
    const buyerId = transaction.user_id
    const sellerId = transaction.metadata?.seller_id

    const { data: syncResult, error: propertyUpdateError } = await supabase.rpc(
      'complete_property_sale_sync',
      {
        tx_id: transactionId,
        nft_hash: nftTransferHash,
      }
    )

    if (propertyUpdateError) {
      console.error('Failed to sync sold property ownership in Supabase:', propertyUpdateError)
      return { data: null, error: { message: 'The blockchain transfer succeeded, but the property record could not be updated in Supabase.' } }
    }

    const updatedProperty = Array.isArray(syncResult) ? syncResult[0] : syncResult

    if (updatedProperty) {
      // Notify buyer about property purchased
      await notifyPropertyPurchased(
        buyerId,
        updatedProperty.property_title || 'Property',
        updatedProperty.property_id
      ).catch(err => console.error('Error notifying buyer:', err))
      
      // Notify seller about property sold
      if (sellerId) {
        await notifyPropertySold(
          sellerId,
          updatedProperty.property_title || 'Property',
          updatedProperty.property_id
        ).catch(err => console.error('Error notifying seller:', err))
      }
    }

    // Fallback: ensure ownership_transfers has a record even if the RPC
    // hasn't been updated with the migration yet. The RPC insert is the
    // primary mechanism; this is a safety net. Duplicate inserts are harmless
    // (the RPC and this JS code may both succeed — that's fine, we just get
    // an extra row which is low-risk).
    try {
      await supabase
        .from('ownership_transfers')
        .insert({
          property_id: transaction.property_id,
          from_owner_id: sellerId,
          to_owner_id: buyerId,
          from_wallet: transaction.metadata?.seller_wallet || null,
          to_wallet: transaction.metadata?.buyer_wallet || null,
          transfer_type: 'sale',
          transaction_id: transactionId,
          blockchain_tx_hash: transaction.blockchain_tx_hash || null,
          nft_transfer_tx_hash: nftTransferHash || null,
        })
    } catch (ownershipErr) {
      // Non-fatal: the RPC may have already inserted the record, or the
      // table may not exist yet. Either way, don't block the completion.
      console.warn('Ownership transfer record fallback insert failed (non-fatal):', ownershipErr?.message)
    }

    // Re-pin IPFS metadata with updated sale information (best-effort)
    try {
      const { data: propertyForIpfs } = await supabase
        .from('properties')
        .select('id, ipfs_metadata_cid, title, location, address, type, bedrooms, bathrooms, sqft, year_built, description, features, price, listing_type, images')
        .eq('id', transaction.property_id)
        .single()

      if (propertyForIpfs?.ipfs_metadata_cid) {
        const { updatePropertyIPFSMetadata } = await import('./ipfs')

        // Build ownership history entry for IPFS
        const ownershipEntry = {
          from: transaction.metadata?.seller_wallet || sellerId || 'Unknown',
          to: transaction.metadata?.buyer_wallet || buyerId || 'Unknown',
          transferType: 'sale',
          date: new Date().toISOString(),
          escrowTxHash: transaction.blockchain_tx_hash || null,
          nftTransferTxHash: nftTransferHash || null,
        }

        const ipfsUpdates = {
          status: 'sold',
          soldAt: new Date().toISOString(),
          soldTo: transaction.metadata?.buyer_wallet || buyerId,
          ownershipHistory: [ownershipEntry],
        }

        const newIpfs = await updatePropertyIPFSMetadata(
          propertyForIpfs.ipfs_metadata_cid,
          ipfsUpdates,
          propertyForIpfs.id
        )

        if (newIpfs) {
          await supabase
            .from('properties')
            .update({
              ipfs_metadata_cid: newIpfs.cid,
              ipfs_metadata_url: newIpfs.gatewayUrl,
              updated_at: new Date().toISOString(),
            })
            .eq('id', transaction.property_id)

          console.log(`[IPFS] Property ${transaction.property_id} metadata updated: ${propertyForIpfs.ipfs_metadata_cid} → ${newIpfs.cid}`)
        }
      } else {
        console.log('[IPFS] No existing IPFS CID on property — skipping metadata re-pin')
      }
    } catch (ipfsErr) {
      // Non-fatal: IPFS re-pin is best-effort. On-chain and Supabase data remain authoritative.
      console.warn('[IPFS] Failed to re-pin metadata after sale (non-fatal):', ipfsErr?.message)
    }
  }

  // When a transaction fails or is cancelled, reset the property and sync the other party
  if (!error && status === 'failed' && transaction.property_id) {
    const { error: resetError } = await supabase.rpc('fail_property_sale_sync', {
      tx_id: transactionId,
    })

    if (resetError) {
      console.error('Failed to reset property sale state:', resetError)
      return { data: null, error: { message: 'The transaction was updated, but the property sale state could not be reset.' } }
    }

    // Update the original offer to reflect it is no longer accepted/active
    if (transaction.metadata?.offer_id) {
      await supabase
        .from('property_offers')
        .update({ 
          status: 'withdrawn',
          updated_at: new Date().toISOString()
        })
        .eq('id', transaction.metadata.offer_id);
    }
  }

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
