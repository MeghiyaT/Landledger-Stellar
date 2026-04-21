import { createEscrowXLM, completeEscrowOnChain } from './contracts'
import { createTransaction, updateTransactionStatus } from './transactions'
import { supabase } from '../lib/supabase'

/**
 * Create a Stellar Escrow for property purchase
 */
export const createEscrowTransaction = async (propertyId, sellerId, buyerId, amountInXlm, deadlineDays = 30, pendingTransactionId = null) => {
  try {
    const { supabaseStorage } = await import('../lib/supabaseStorage')
    
    // Fetch profiles for public keys
    const [{ data: seller }, { data: buyer }] = await Promise.all([
      supabaseStorage.from('profiles').select('wallet_address').eq('id', sellerId).single(),
      supabaseStorage.from('profiles').select('wallet_address').eq('id', buyerId).single()
    ])

    if (!seller?.wallet_address || !buyer?.wallet_address) {
      throw new Error('Both buyer and seller must have Stellar wallets connected.')
    }

    const { data: property } = await supabase
      .from('properties')
      .select('blockchain_property_id')
      .eq('id', propertyId)
      .single()

    const propertyIdOnChain = property?.blockchain_property_id || '0'
    const deadline = Math.floor(Date.now() / 1000) + (deadlineDays * 24 * 60 * 60)

    // Call Soroban Escrow
    const result = await createEscrowXLM(
      propertyIdOnChain,
      seller.wallet_address,
      amountInXlm,
      deadline
    )

    // If we have a pending transaction ID, fetch the transaction to get its offer_id
    let offerId = null;
    let sellerTxId = null;
    if (pendingTransactionId) {
      const { data: pendingTx } = await supabase
        .from('transactions')
        .select('metadata')
        .eq('id', pendingTransactionId)
        .single();
      offerId = pendingTx?.metadata?.offer_id;

      if (offerId) {
        // Find the corresponding seller transaction for the same offer
        const { data: sellerTxData } = await supabase
          .from('transactions')
          .select('id')
          .eq('user_id', sellerId)
          .eq('transaction_type', 'sale')
          .contains('metadata', { offer_id: offerId })
          .single();
        sellerTxId = sellerTxData?.id;
      }
    }

    const updateData = {
      status: 'in_progress',
      blockchain_tx_hash: result.hash,
      description: `XLM Escrow created for property purchase. Funds locked on Stellar Testnet.`,
      updated_at: new Date().toISOString()
    }
    
    // We update the metadata while preserving existing data (like offer_id)
    if (pendingTransactionId) {
        const { data: currentTx } = await supabase.from('transactions').select('metadata').eq('id', pendingTransactionId).single();
        updateData.metadata = {
          ...currentTx?.metadata,
          escrow_type: 'native',
          escrow_transaction_id: 'stellar-escrow',
          deadline,
          seller_wallet: seller.wallet_address,
          buyer_wallet: buyer.wallet_address,
        }
        
        // Update buyer tx
        await supabase.from('transactions').update(updateData).eq('id', pendingTransactionId);
        
        // Update seller tx
        if (sellerTxId) {
            const { data: currentSellerTx } = await supabase.from('transactions').select('metadata').eq('id', sellerTxId).single();
            await supabase.from('transactions').update({
                ...updateData,
                metadata: {
                    ...currentSellerTx?.metadata,
                    ...updateData.metadata
                }
            }).eq('id', sellerTxId);
        }
        
        return { data: { hash: result.hash }, error: null }
    } else {
        // Fallback: create new transaction
        const transactionData = {
          user_id: buyerId,
          property_id: propertyId,
          transaction_type: 'purchase',
          amount: amountInXlm,
          currency: 'XLM',
          ...updateData,
          metadata: {
            escrow_type: 'native',
            escrow_transaction_id: 'stellar-escrow',
            deadline,
            seller_wallet: seller.wallet_address,
            buyer_wallet: buyer.wallet_address,
          }
        }
        return await createTransaction(transactionData)
    }
  } catch (error) {
    console.error('Error creating Stellar escrow:', error)
    return { data: null, error: { message: error.message } }
  }
}

/**
 * Complete Stellar Escrow
 */
export const completeEscrowTransaction = async (transactionId, userId) => {
  try {
    const { data: transaction } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single()

    if (transaction?.metadata?.escrow_transaction_id) {
      await completeEscrowOnChain(transaction.metadata.escrow_transaction_id)
      return await updateTransactionStatus(transactionId, 'completed', userId)
    }
    
    throw new Error('Missing escrow tracking ID.')
  } catch (error) {
    console.error('Error completing Stellar escrow:', error)
    return { data: null, error: { message: error.message } }
  }
}
