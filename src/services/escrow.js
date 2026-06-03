import { createEscrowXLM, completeEscrowOnChain } from './contracts'
import { createTransaction, updateTransactionStatus } from './transactions'
import { supabase } from '../lib/supabase'
import { getWalletAddresses } from './user'

/**
 * Create a Stellar Escrow for property purchase
 */
export const createEscrowTransaction = async (propertyId, sellerId, buyerId, amountInXlm, deadlineDays = 30, pendingTransactionId = null) => {
  try {
    let pendingTx = null
    if (pendingTransactionId) {
      const { data } = await supabase
        .from('transactions')
        .select('metadata')
        .eq('id', pendingTransactionId)
        .single()
      pendingTx = data
    }

    if (pendingTx?.metadata?.escrow_ready === false) {
      throw new Error('The seller still needs to finish the required on-chain approvals before escrow can be created.')
    }

    const { data: wallets, error: walletError } = await getWalletAddresses([sellerId, buyerId])
    if (walletError) {
      throw walletError
    }

    const seller = { wallet_address: wallets?.[sellerId] }
    const buyer = { wallet_address: wallets?.[buyerId] }

    if (!seller?.wallet_address || !buyer?.wallet_address) {
      throw new Error('Both buyer and seller must have Stellar wallets connected.')
    }

    const { data: property } = await supabase
      .from('properties')
      .select('blockchain_property_id')
      .eq('id', propertyId)
      .single()

    if (!property?.blockchain_property_id) {
      throw new Error('This property is missing its on-chain property ID.')
    }

    const propertyIdOnChain = property.blockchain_property_id
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
        const { data: currentTx, error: fetchTxError } = await supabase
          .from('transactions')
          .select('metadata')
          .eq('id', pendingTransactionId)
          .single();

        if (fetchTxError) {
          console.error('Escrow DB: failed to fetch buyer transaction metadata:', fetchTxError)
          // On-chain succeeded — return the hash but surface the DB error so UI shows it
          return {
            data: null,
            error: {
              message: `Payment was sent on-chain (TX: ${result.hash.slice(0, 12)}…) but the transaction record could not be updated due to a database permission error. Please run the fix-transactions-rls.sql script in your Supabase SQL Editor to resolve this.`,
              txHash: result.hash,
            }
          }
        }

        updateData.metadata = {
          ...currentTx?.metadata,
          escrow_type: 'native',
          escrow_transaction_id: result.escrowId,
          escrow_ready: true,
          deadline,
          seller_wallet: seller.wallet_address,
          buyer_wallet: buyer.wallet_address,
        }
        
        // Update buyer tx
        const { error: buyerUpdateError } = await supabase
          .from('transactions')
          .update(updateData)
          .eq('id', pendingTransactionId);

        if (buyerUpdateError) {
          console.error('Escrow DB: failed to update buyer transaction:', buyerUpdateError)
          return {
            data: null,
            error: {
              message: `Payment was sent on-chain (TX: ${result.hash.slice(0, 12)}…) but your transaction record could not be updated. This is a database permission issue — please run the fix-transactions-rls.sql script in your Supabase SQL Editor.`,
              txHash: result.hash,
            }
          }
        }
        
        // Update seller tx (non-fatal — log a warning but do not block the buyer)
        if (sellerTxId) {
            const { data: currentSellerTx } = await supabase
              .from('transactions')
              .select('metadata')
              .eq('id', sellerTxId)
              .single();

            const { error: sellerUpdateError } = await supabase
              .from('transactions')
              .update({
                ...updateData,
                metadata: {
                    ...currentSellerTx?.metadata,
                    escrow_ready: true,
                    ...updateData.metadata
                }
              })
              .eq('id', sellerTxId);

            if (sellerUpdateError) {
              // Non-fatal: buyer tx succeeded, just log the seller sync failure
              console.warn('Escrow DB: failed to update seller transaction (non-fatal):', sellerUpdateError)
            }
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
            escrow_transaction_id: result.escrowId,
            escrow_ready: true,
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
