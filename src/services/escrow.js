import { createEscrowToken, completeEscrow, cancelEscrow } from './contracts'
import { createTransaction, updateTransactionStatus } from './transactions'
import { supabase } from '../lib/supabase'
import { ethers } from 'ethers'
import { notifyAmountDeducted, notifyAmountReceived } from './notifications'

/**
 * Create an escrow transaction for a property purchase using PROP tokens
 * @param {string} propertyId - Property ID from Supabase
 * @param {string} sellerId - Seller user ID
 * @param {string} buyerId - Buyer user ID  
 * @param {number} amountInTokens - Amount in PROP tokens
 * @param {number} deadlineDays - Number of days until deadline
 * @returns {Promise<{data: object, error: object}>}
 */
export const createEscrowTransaction = async (propertyId, sellerId, buyerId, amountInTokens, deadlineDays = 30) => {
  try {
    // Get seller's wallet address from profile
    const { supabaseStorage } = await import('../lib/supabaseStorage')
    const { data: sellerProfile } = await supabaseStorage
      .from('profiles')
      .select('wallet_address')
      .eq('id', sellerId)
      .single()

    if (!sellerProfile?.wallet_address) {
      return {
        data: null,
        error: { message: 'Seller wallet address not found. Seller must connect their wallet.' }
      }
    }

    // Get buyer's wallet address
    const { data: buyerProfile } = await supabaseStorage
      .from('profiles')
      .select('wallet_address')
      .eq('id', buyerId)
      .single()

    if (!buyerProfile?.wallet_address) {
      return {
        data: null,
        error: { message: 'Buyer wallet address not found. Buyer must connect their wallet.' }
      }
    }

    // Get property blockchain ID if available
    const { data: property } = await supabase
      .from('properties')
      .select('blockchain_property_id')
      .eq('id', propertyId)
      .single()

    const blockchainPropertyId = property?.blockchain_property_id || '0' // Use 0 if not on-chain

    // Calculate deadline timestamp
    const deadline = Math.floor(Date.now() / 1000) + (deadlineDays * 24 * 60 * 60)

    // Convert token amount to wei (18 decimals)
    const amountInWei = ethers.parseEther(amountInTokens.toString())

    // Approve tokens first (buyer needs to approve escrow contract to spend tokens)
    const { approvePropertyTokens } = await import('./contracts')
    
    // Get contract addresses - use the same method as contracts.js
    const getContractAddresses = async () => {
      try {
        const response = await fetch('/deployment-addresses.json')
        if (response.ok) {
          const data = await response.json()
          return data.contracts
        }
      } catch (error) {
        console.log('Could not load deployment-addresses.json, using env variables')
      }
      return {
        Escrow: import.meta.env.VITE_ESCROW_ADDRESS,
      }
    }
    
    const addresses = await getContractAddresses()
    if (!addresses.Escrow) {
      return {
        data: null,
        error: { message: 'Escrow contract address not configured' }
      }
    }

    // Approve escrow contract to spend tokens
    try {
      const approveTx = await approvePropertyTokens(addresses.Escrow, amountInWei)
      await approveTx.wait()
      console.log('Token approval successful')
    } catch (approveError) {
      console.error('Token approval failed:', approveError)
      return {
        data: null,
        error: { message: `Failed to approve tokens: ${approveError.message || 'Please approve token spending in MetaMask'}` }
      }
    }

    // Create token escrow on blockchain
    const tx = await createEscrowToken(
      blockchainPropertyId,
      sellerProfile.wallet_address,
      amountInWei,
      deadline
    )

    const receipt = await tx.wait()
    const escrowTxHash = receipt.hash

    // Notify buyer about token deduction
    try {
      await notifyAmountDeducted(
        buyerId,
        amountInTokens,
        `Escrow created for property purchase`,
        escrowTxHash
      )
    } catch (notifError) {
      console.error('Error creating deduction notification:', notifError)
    }

    // Extract escrow transaction ID from events
    let escrowTransactionId = null
    try {
      const { ethers } = await import('ethers')
      const ESCROW_ABI = [
        'event EscrowCreated(uint256 indexed transactionId, uint256 indexed propertyId, address indexed buyer, address seller, uint256 amount, bool isTokenPayment)'
      ]
      const iface = new ethers.Interface(ESCROW_ABI)
      const event = receipt.logs.find(log => {
        try {
          const parsed = iface.parseLog(log)
          return parsed && parsed.name === 'EscrowCreated'
        } catch {
          return false
        }
      })
      
      if (event) {
        const parsed = iface.parseLog(event)
        escrowTransactionId = parsed.args.transactionId.toString()
      }
    } catch (error) {
      console.error('Error parsing escrow event:', error)
    }

    // Create transaction record in Supabase
    const transactionData = {
      user_id: buyerId,
      property_id: propertyId,
      transaction_type: 'purchase',
      amount: amountInTokens, // Store in tokens (already converted from INR)
      currency: 'PROP',
      status: 'in_progress',
      description: `Token escrow transaction for property purchase - ${amountInTokens.toLocaleString('en-IN', { maximumFractionDigits: 4 })} PROP tokens locked in escrow`,
      blockchain_tx_hash: escrowTxHash,
      metadata: {
        escrow_type: 'token',
        escrow_transaction_id: escrowTransactionId,
        deadline,
        seller_wallet: sellerProfile.wallet_address,
        buyer_wallet: buyerProfile.wallet_address,
        amount_in_wei: amountInWei.toString(),
        amount_in_tokens: amountInTokens.toString(), // Store for easy reference
      }
    }

    const { data: transaction, error: transactionError } = await createTransaction(transactionData)

    if (transactionError) {
      return { data: null, error: transactionError }
    }

    return {
      data: {
        transaction,
        escrowTxHash,
        escrowTransactionId,
      },
      error: null
    }
  } catch (error) {
    console.error('Error creating escrow transaction:', error)
    return {
      data: null,
      error: { message: error.message || 'Failed to create escrow transaction' }
    }
  }
}

/**
 * Complete an escrow transaction
 * @param {string} transactionId - Transaction ID from Supabase
 * @param {string} userId - User ID (must be seller)
 * @returns {Promise<{data: object, error: object}>}
 */
export const completeEscrowTransaction = async (transactionId, userId) => {
  try {
    // Get transaction with escrow info
    const { supabase } = await import('../lib/supabase')
    const { data: transaction, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single()

    if (fetchError || !transaction) {
      return { data: null, error: fetchError || { message: 'Transaction not found' } }
    }

    if (transaction.metadata?.escrow_transaction_id) {
      // Complete escrow on blockchain
      const tx = await completeEscrow(transaction.metadata.escrow_transaction_id)
      const receipt = await tx.wait()

      // Notify seller about token receipt
      try {
        await notifyAmountReceived(
          userId,
          transaction.amount,
          `Property sale completed`,
          receipt.hash
        )
      } catch (notifError) {
        console.error('Error creating receipt notification:', notifError)
      }

      // Update transaction status
      return await updateTransactionStatus(transactionId, 'completed', userId)
    } else {
      return {
        data: null,
        error: { message: 'No escrow transaction ID found' }
      }
    }
  } catch (error) {
    console.error('Error completing escrow:', error)
    return {
      data: null,
      error: { message: error.message || 'Failed to complete escrow' }
    }
  }
}

/**
 * Cancel an escrow transaction
 * @param {string} transactionId - Transaction ID from Supabase
 * @param {string} userId - User ID (must be buyer)
 * @returns {Promise<{data: object, error: object}>}
 */
export const cancelEscrowTransaction = async (transactionId, userId) => {
  try {
    // Get transaction with escrow info
    const { supabase } = await import('../lib/supabase')
    const { data: transaction, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single()

    if (fetchError || !transaction) {
      return { data: null, error: fetchError || { message: 'Transaction not found' } }
    }

    if (transaction.user_id !== userId) {
      return { data: null, error: { message: 'Only the buyer can cancel escrow' } }
    }

    if (transaction.metadata?.escrow_transaction_id) {
      // Cancel escrow on blockchain
      const tx = await cancelEscrow(transaction.metadata.escrow_transaction_id)
      await tx.wait()

      // Update transaction status
      return await updateTransactionStatus(transactionId, 'failed', userId)
    } else {
      return {
        data: null,
        error: { message: 'No escrow transaction ID found' }
      }
    }
  } catch (error) {
    console.error('Error cancelling escrow:', error)
    return {
      data: null,
      error: { message: error.message || 'Failed to cancel escrow' }
    }
  }
}

