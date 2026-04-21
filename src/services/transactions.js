import { supabase } from '../lib/supabase'
import { completeEscrow, transferPropertyNFT } from './contracts'
import { notifyTransactionCompleted } from './notifications'

export const getTransactions = async (userId, filters = {}) => {
  console.log('getTransactions called with:', { userId, filters })
  
  let query = supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)

  // Filter by status if provided
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  // Filter by type if provided
  if (filters.type && filters.type !== 'all') {
    query = query.eq('transaction_type', filters.type)
  }

  query = query.order('created_at', { ascending: false })

  // Limit if provided
  if (filters.limit) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query

  // Fetch blockchain transactions if wallet address is available
  let blockchainTransactions = []
  if (!error && userId) {
    try {
      // Get user's wallet address from profile
      const { supabaseStorage } = await import('../lib/supabaseStorage')
      const { data: profile, error: profileError } = await supabaseStorage
        .from('profiles')
        .select('wallet_address')
        .eq('id', userId)
        .single()

      if (!profileError && profile?.wallet_address) {
        const { data: blockchainTxs, error: blockchainError } = await getBlockchainTransactions(profile.wallet_address)
        if (!blockchainError && blockchainTxs && blockchainTxs.length > 0) {
          // Set user_id for blockchain transactions
          blockchainTransactions = blockchainTxs.map(tx => ({
            ...tx,
            user_id: userId
          }))
        }
      }
    } catch (blockchainErr) {
      console.error('Error fetching blockchain transactions:', blockchainErr)
      // Don't fail the query if blockchain fetch fails
    }
  }

  // Auto-sync transaction status for purchase transactions where ownership has been transferred
  // This fixes cases where property ownership was transferred but transaction status wasn't updated
  if (!error && data && data.length > 0) {
    try {
      const purchaseTransactions = data.filter(tx => 
        tx.transaction_type === 'purchase' && 
        tx.property_id && 
        (tx.status === 'pending' || tx.status === 'in_progress')
      )

      if (purchaseTransactions.length > 0) {
        // Check each purchase transaction to see if property ownership has been transferred
        for (const tx of purchaseTransactions) {
          const { data: property, error: propError } = await supabase
            .from('properties')
            .select('user_id, sold_to')
            .eq('id', tx.property_id)
            .single()

          // If property ownership has been transferred to the buyer (user_id = buyer or sold_to = buyer)
          // and the transaction is still pending/in_progress, update it to completed
          if (!propError && property && (property.user_id === userId || property.sold_to === userId)) {
            // Ownership has been transferred, update transaction status
            await supabase
              .from('transactions')
              .update({
                status: 'completed',
                updated_at: new Date().toISOString()
              })
              .eq('id', tx.id)
            
            // Update the transaction in the returned data
            const txIndex = data.findIndex(t => t.id === tx.id)
            if (txIndex !== -1) {
              data[txIndex].status = 'completed'
              data[txIndex].updated_at = new Date().toISOString()
            }
          }
        }
      }
    } catch (syncError) {
      console.error('Error syncing transaction status:', syncError)
      // Don't fail the query if sync fails
    }
  }

  // Merge database transactions with blockchain transactions
  // Remove duplicates (blockchain transactions that already exist in database by tx hash)
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
    
    // Sort by created_at descending
    allTransactions.sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    )

    // Apply filters to merged transactions
    if (filters.status && filters.status !== 'all') {
      allTransactions = allTransactions.filter(tx => tx.status === filters.status)
    }
    if (filters.type && filters.type !== 'all') {
      allTransactions = allTransactions.filter(tx => tx.transaction_type === filters.type)
    }
    if (filters.limit) {
      allTransactions = allTransactions.slice(0, filters.limit)
    }
  }

  console.log('getTransactions result:', {
    dataCount: allTransactions?.length || 0,
    dbCount: data?.length || 0,
    blockchainCount: blockchainTransactions.length,
    error: error ? {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    } : null,
    sampleData: allTransactions?.slice(0, 2) // First 2 transactions for debugging
  })

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
  // First verify the transaction belongs to the user and check transaction type
  const { data: transaction, error: fetchError } = await supabase
    .from('transactions')
    .select('user_id, transaction_type, property_id, metadata')
    .eq('id', transactionId)
    .single()

  if (fetchError || !transaction) {
    return { data: null, error: fetchError || { message: 'Transaction not found' } }
  }

  if (transaction.user_id !== userId) {
    return { data: null, error: { message: 'You can only update your own transactions' } }
  }

  // Only buyers can mark transactions as completed (Escrow protection)
  // Sellers have transaction_type 'sale' (for purchases) or are the original property owner (for rentals)
  // Buyers have transaction_type 'purchase' (for purchases) or are renters (for rentals)
  if (status === 'completed') {
    // Check if user is the seller
    let isSeller = false

    if (transaction.transaction_type === 'sale') {
      // 'sale' transaction type means this is the seller's transaction
      isSeller = true
    } else if (transaction.transaction_type === 'purchase') {
      // 'purchase' transaction type means this is the buyer's transaction
      isSeller = false
    } else if (transaction.transaction_type === 'rental') {
      // For rentals, check metadata first (seller_id stored there)
      // If not in metadata, check property ownership
      if (transaction.metadata?.seller_id) {
        isSeller = transaction.metadata.seller_id === userId
      } else if (transaction.property_id) {
        // Fallback: check property ownership
        const { data: property, error: propertyError } = await supabase
          .from('properties')
          .select('user_id')
          .eq('id', transaction.property_id)
          .single()
        
        if (!propertyError && property) {
          // If the transaction's user_id matches the property's user_id, this is the seller's transaction
          isSeller = property.user_id === userId
        } else {
          // If we can't determine, default to not allowing completion
          isSeller = false
        }
      } else {
        isSeller = false
      }
    }

    if (isSeller) {
      return { 
        data: null, 
        error: { message: 'Only the buyer can mark transactions as completed to prevent escrow fraud' } 
      }
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

  // If transaction is being marked as completed and it's a sale transaction, transfer ownership
  // Also try to complete escrow if it exists - THIS TRANSFERS TOKENS FROM BUYER TO SELLER
  if (status === 'completed' && transaction.transaction_type === 'sale' && transaction.property_id) {
    // Complete escrow FIRST to transfer tokens from buyer to seller
    if (transaction.metadata?.escrow_transaction_id) {
      try {
        console.log('Completing escrow to transfer tokens...', {
          escrowTransactionId: transaction.metadata.escrow_transaction_id,
          amount: transaction.amount,
          currency: transaction.currency
        })
        
        const tx = await completeEscrow(transaction.metadata.escrow_transaction_id)
        const receipt = await tx.wait()
        
        console.log('Escrow completed successfully - tokens transferred to seller', {
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber
        })
        
        // Extract OwnershipTransferred event from receipt to get ownership transfer details
        try {
          const { ethers } = await import('ethers')
          const PROPERTY_REGISTRY_ABI = [
            'event OwnershipTransferred(uint256 indexed propertyId, address indexed previousOwner, address indexed newOwner, string transferType)'
          ]
          const iface = new ethers.Interface(PROPERTY_REGISTRY_ABI)
          const ownershipEvent = receipt.logs.find(log => {
            try {
              const parsed = iface.parseLog(log)
              return parsed && parsed.name === 'OwnershipTransferred'
            } catch {
              return false
            }
          })
          
          if (ownershipEvent) {
            const parsed = iface.parseLog(ownershipEvent)
            console.log('Ownership transferred on blockchain:', {
              propertyId: parsed.args.propertyId.toString(),
              previousOwner: parsed.args.previousOwner,
              newOwner: parsed.args.newOwner,
              transferType: parsed.args.transferType,
              txHash: receipt.hash
            })
          }
        } catch (eventError) {
          console.warn('Could not parse ownership transfer event:', eventError)
        }
        
        // Verify the escrow was completed by checking the transaction
        try {
          const { getEscrowTransaction } = await import('./contracts')
          const escrowData = await getEscrowTransaction(transaction.metadata.escrow_transaction_id)
          if (escrowData.isCompleted) {
            console.log('Escrow verification: Tokens successfully transferred', {
              seller: escrowData.seller,
              amount: escrowData.amount,
              isTokenPayment: escrowData.isTokenPayment
            })
          }
        } catch (verifyError) {
          console.warn('Could not verify escrow completion:', verifyError)
        }
      } catch (escrowError) {
        console.error('Error completing escrow on blockchain:', escrowError)
        // Return error to prevent transaction completion if escrow fails
        return {
          data: null,
          error: {
            message: `Failed to complete escrow and transfer tokens: ${escrowError.message || escrowError.reason || 'Unknown error'}. Please try again or contact support.`
          }
        }
      }
    } else if (transaction.metadata?.escrow_type === 'token' || transaction.currency === 'PROP') {
      // If transaction uses tokens but no escrow ID, warn but don't fail
      console.warn('Transaction marked as token-based but no escrow transaction ID found', {
        transactionId,
        currency: transaction.currency,
        metadata: transaction.metadata
      })
    }
    console.log('Transaction completed - transferring property ownership')
    
    try {
      // Get the property and transaction details
      const { data: property, error: propertyError } = await supabase
        .from('properties')
        .select('id, user_id, ownership_history, sold_to, created_at, blockchain_property_id, nft_token_id')
        .eq('id', transaction.property_id)
        .single()

      if (propertyError || !property) {
        console.error('Error fetching property for ownership transfer:', propertyError)
        // Don't fail the transaction update, just log the error
      } else {
        // Get buyer ID from sold_to or transaction metadata
        const buyerId = property.sold_to || transaction.metadata?.buyer_id
        
        if (!buyerId) {
          console.error('Cannot transfer ownership: buyer ID not found in sold_to or metadata')
        } else {
          // IMPORTANT: Get seller ID from transaction metadata or property
          // At this point, property.user_id might already be the buyer if ownership was transferred earlier
          // So we need to get seller_id from metadata, or check if user_id is still the seller
          const sellerId = transaction.metadata?.seller_id || 
                          (property.user_id !== buyerId ? property.user_id : null) ||
                          transaction.user_id // Fallback to transaction creator (seller for sale transactions)
          
          if (!sellerId) {
            console.error('Cannot determine seller ID for ownership history')
          }
          
          // Get seller and buyer profile information for ownership history
          // Note: profiles.id is TEXT (Clerk user ID), not UUID
          const { supabaseStorage } = await import('../lib/supabaseStorage')
          const [sellerProfileResult, buyerProfileResult] = await Promise.all([
            sellerId ? supabaseStorage.from('profiles').select('full_name, email').eq('id', sellerId).maybeSingle() : Promise.resolve({ data: null }),
            supabaseStorage.from('profiles').select('full_name, email').eq('id', buyerId).maybeSingle()
          ])

          // Use seller's actual name from profile, with better fallbacks
          const sellerName = sellerProfileResult.data?.full_name || 
                            (sellerProfileResult.data?.email ? sellerProfileResult.data.email.split('@')[0] : null) ||
                            (sellerId ? `Seller (${sellerId.slice(0, 8)}...)` : 'Previous Owner')
          const buyerName = buyerProfileResult.data?.full_name || 
                           (buyerProfileResult.data?.email ? buyerProfileResult.data.email.split('@')[0] : null) ||
                           `Buyer (${buyerId.slice(0, 8)}...)`

          // Prepare ownership history entry for the seller
          const currentDate = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
          const propertyCreatedDate = property.created_at 
            ? new Date(property.created_at).toISOString().split('T')[0] 
            : currentDate

          const sellerOwnershipEntry = {
            owner_name: sellerName,
            from_date: propertyCreatedDate,
            to_date: currentDate,
            transfer_type: 'sale',
            notes: `Sold to ${buyerName}`
          }

          // Get existing ownership history or initialize as empty array
          let ownershipHistory = property.ownership_history || []
          if (!Array.isArray(ownershipHistory)) {
            ownershipHistory = []
          }

          // Add seller to ownership history
          ownershipHistory.push(sellerOwnershipEntry)

          // Update property: transfer ownership to buyer and update ownership history
          // IMPORTANT: Keep sold_to set to buyerId so property remains in purchased properties
          const { error: updateError } = await supabase
            .from('properties')
            .update({
              user_id: buyerId, // Transfer ownership to buyer
              sold_to: buyerId, // Ensure sold_to is still set (in case it wasn't)
              ownership_history: ownershipHistory, // Add seller to history
              updated_at: new Date().toISOString()
            })
            .eq('id', transaction.property_id)
          
          // Remove property from buyer's saved properties (if saved)
          // This ensures purchased properties don't appear in favorites
          if (!updateError) {
            const { error: removeSavedError } = await supabase
              .from('saved_properties')
              .delete()
              .eq('user_id', buyerId)
              .eq('property_id', transaction.property_id)
            
            if (removeSavedError) {
              console.error('Error removing property from saved properties:', removeSavedError)
              // Don't fail the transaction update if this fails, just log it
            } else {
              console.log('Removed purchased property from saved properties')
            }
          }

          if (updateError) {
            console.error('Error transferring property ownership:', updateError)
            console.error('Update error details:', {
              code: updateError.code,
              message: updateError.message,
              details: updateError.details,
              hint: updateError.hint
            })
            // Don't fail the transaction update, but log the error
          } else {
            console.log('Property ownership transferred successfully:', {
              propertyId: transaction.property_id,
              fromSeller: property.user_id,
              toBuyer: buyerId,
              ownershipHistoryUpdated: true,
              sellerAddedToHistory: sellerOwnershipEntry
            })

            // Transfer NFT to buyer if property has an NFT
            if (property.blockchain_property_id) {
              try {
                // Get buyer's wallet address
                const { supabaseStorage } = await import('../lib/supabaseStorage')
                const { data: buyerProfile, error: buyerProfileError } = await supabaseStorage
                  .from('profiles')
                  .select('wallet_address')
                  .eq('id', buyerId)
                  .single()

                if (!buyerProfileError && buyerProfile?.wallet_address) {
                  // Transfer NFT on blockchain
                  const nftTransferResult = await transferPropertyNFT(
                    property.blockchain_property_id,
                    buyerProfile.wallet_address
                  )

                  if (nftTransferResult.txHash) {
                    console.log('NFT transferred successfully:', {
                      propertyId: transaction.property_id,
                      blockchainPropertyId: property.blockchain_property_id,
                      tokenId: nftTransferResult.tokenId,
                      from: nftTransferResult.from,
                      to: nftTransferResult.to,
                      txHash: nftTransferResult.txHash
                    })

                    // Update property with NFT transfer transaction hash
                    await supabase
                      .from('properties')
                      .update({
                        nft_transfer_tx_hash: nftTransferResult.txHash,
                        updated_at: new Date().toISOString()
                      })
                      .eq('id', transaction.property_id)
                      .catch(err => {
                        console.error('Error updating NFT transfer tx hash:', err)
                      })
                  }
                } else {
                  console.warn('Buyer wallet address not found, skipping NFT transfer')
                }
              } catch (nftError) {
                console.error('Error transferring NFT:', nftError)
                // Don't fail the transaction if NFT transfer fails
                // The property ownership is already transferred in the database
              }
            }

            // Also update the buyer's transaction status to 'completed'
            // Find the buyer's transaction (transaction_type = 'purchase' for the same property)
            try {
              const { data: buyerTransactions, error: buyerTxError } = await supabase
                .from('transactions')
                .select('id, status')
                .eq('property_id', transaction.property_id)
                .eq('user_id', buyerId)
                .eq('transaction_type', 'purchase')
                .in('status', ['pending', 'in_progress']) // Only update if not already completed
              
              if (!buyerTxError && buyerTransactions && buyerTransactions.length > 0) {
                // Update all buyer transactions for this property to completed
                const buyerTxIds = buyerTransactions.map(tx => tx.id)
                const { error: updateBuyerTxError } = await supabase
                  .from('transactions')
                  .update({
                    status: 'completed',
                    updated_at: new Date().toISOString()
                  })
                  .in('id', buyerTxIds)
                
                if (updateBuyerTxError) {
                  console.error('Error updating buyer transaction status:', updateBuyerTxError)
                } else {
                  console.log('Buyer transaction(s) updated to completed:', buyerTxIds)
                }
              }
            } catch (buyerTxUpdateError) {
              console.error('Error updating buyer transaction status:', buyerTxUpdateError)
              // Don't fail the main transaction update if this fails
            }

            // Notify buyer about transaction completion
            try {
              await notifyTransactionCompleted(
                buyerId,
                'purchase',
                transaction.currency === 'PROP' 
                  ? `${transaction.amount} PROP tokens`
                  : `${transaction.currency} ${transaction.amount}`,
                transaction.id
              )
            } catch (notifError) {
              console.error('Error creating transaction completed notification for buyer:', notifError)
            }

            // Notify seller about transaction completion
            try {
              await notifyTransactionCompleted(
                transaction.user_id, // Seller's user_id
                'sale',
                transaction.currency === 'PROP' 
                  ? `${transaction.amount} PROP tokens`
                  : `${transaction.currency} ${transaction.amount}`,
                transaction.id
              )
            } catch (notifError) {
              console.error('Error creating transaction completed notification for seller:', notifError)
            }
          }
        }
      }
    } catch (err) {
      console.error('Error in ownership transfer process:', err)
      // Don't fail the transaction update, just log the error
    }
  }

  // Also notify when transaction is completed for non-sale transactions (rentals, etc.)
  if (status === 'completed' && transaction.transaction_type !== 'sale') {
    try {
      await notifyTransactionCompleted(
        transaction.user_id,
        transaction.transaction_type,
        transaction.currency === 'PROP' 
          ? `${transaction.amount} PROP tokens`
          : `${transaction.currency} ${transaction.amount}`,
        transaction.id
      )
    } catch (notifError) {
      console.error('Error creating transaction completed notification:', notifError)
    }
  }

  return { data, error }
}

// Send blockchain transaction (ETH payment)
export const sendBlockchainTransaction = async (toAddress, amountInEth, transactionId) => {
  try {
    // Import web3 functions dynamically to avoid issues if not available
    const { sendTransaction, waitForTransaction } = await import('../lib/web3')
    
    // Send ETH transaction
    const tx = await sendTransaction(toAddress, amountInEth)
    
    // Update transaction with blockchain hash
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        blockchain_tx_hash: tx.hash,
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .eq('id', transactionId)

    if (updateError) {
      console.error('Error updating transaction with blockchain hash:', updateError)
      return { data: null, error: updateError }
    }

    // Wait for transaction confirmation (1 confirmation)
    const receipt = await waitForTransaction(tx.hash, 1)

    if (receipt && receipt.status === 1) {
      // Transaction successful
      await supabase
        .from('transactions')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', transactionId)
    } else {
      // Transaction failed
      await supabase
        .from('transactions')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', transactionId)
    }

    return { data: { txHash: tx.hash, receipt }, error: null }
  } catch (error) {
    console.error('Error sending blockchain transaction:', error)
    
    // Update transaction status to failed
    await supabase
      .from('transactions')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('id', transactionId)
      .catch(console.error)

    return { data: null, error }
  }
}

// Verify blockchain transaction
export const verifyBlockchainTransaction = async (txHash) => {
  try {
    const { getTransactionReceipt } = await import('../lib/web3')
    const receipt = await getTransactionReceipt(txHash)
    return { data: receipt, error: null }
  } catch (error) {
    console.error('Error verifying blockchain transaction:', error)
    return { data: null, error }
  }
}

// Update transaction with blockchain hash (for manual entry)
export const updateTransactionWithBlockchainHash = async (transactionId, txHash, userId) => {
  // Verify transaction belongs to user
  const { data: transaction, error: fetchError } = await supabase
    .from('transactions')
    .select('user_id')
    .eq('id', transactionId)
    .single()

  if (fetchError || !transaction) {
    return { data: null, error: fetchError || { message: 'Transaction not found' } }
  }

  if (transaction.user_id !== userId) {
    return { data: null, error: { message: 'You can only update your own transactions' } }
  }

  // Verify the transaction on blockchain
  const { data: receipt, error: verifyError } = await verifyBlockchainTransaction(txHash)
  
  if (verifyError || !receipt) {
    return { 
      data: null, 
      error: { message: 'Transaction not found on blockchain. Please verify the transaction hash.' } 
    }
  }

  // Update transaction with hash and status
  const status = receipt.status === 1 ? 'completed' : 'failed'
  const { data, error } = await supabase
    .from('transactions')
    .update({
      blockchain_tx_hash: txHash,
      status,
      updated_at: new Date().toISOString()
    })
    .eq('id', transactionId)
    .select()
    .single()

  return { data, error }
}

// Fetch blockchain transactions for a user's wallet address
export const getBlockchainTransactions = async (walletAddress) => {
  if (!walletAddress) {
    return { data: [], error: null }
  }

  try {
    const { ethers } = await import('ethers')
    const { isMetaMaskInstalled } = await import('../lib/web3')
    
    if (!isMetaMaskInstalled()) {
      return { data: [], error: null }
    }

    const provider = new ethers.BrowserProvider(window.ethereum)
    
    // Get contract addresses
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
        PropertyRegistry: import.meta.env.VITE_PROPERTY_REGISTRY_ADDRESS,
        Escrow: import.meta.env.VITE_ESCROW_ADDRESS,
      }
    }
    
    const addresses = await getContractAddresses()
    const blockchainTransactions = []

    // Fetch OwnershipTransferred events (where user is buyer or seller)
    if (addresses.PropertyRegistry) {
      const PROPERTY_REGISTRY_ABI = [
        'event OwnershipTransferred(uint256 indexed propertyId, address indexed previousOwner, address indexed newOwner, string transferType)'
      ]
      const registryContract = new ethers.Contract(addresses.PropertyRegistry, PROPERTY_REGISTRY_ABI, provider)
      
      try {
        // Get events from last 10000 blocks (approximately last 35 days on Sepolia)
        const currentBlock = await provider.getBlockNumber()
        const fromBlock = Math.max(0, currentBlock - 10000)
        
        const ownershipEvents = await registryContract.queryFilter(
          registryContract.filters.OwnershipTransferred(null, null, null),
          fromBlock,
          'latest'
        )

        for (const event of ownershipEvents) {
          const args = event.args
          const previousOwner = args.previousOwner?.toLowerCase()
          const newOwner = args.newOwner?.toLowerCase()
          const userAddress = walletAddress.toLowerCase()
          
          // Check if user is involved (as buyer or seller)
          if (previousOwner === userAddress || newOwner === userAddress) {
            const receipt = await event.getTransactionReceipt()
            const block = await provider.getBlock(receipt.blockNumber)
            
            blockchainTransactions.push({
              id: `blockchain-ownership-${event.transactionHash}-${event.logIndex}`,
              user_id: null, // Will be set by caller
              property_id: null, // Property ID from blockchain
              blockchain_property_id: args.propertyId.toString(),
              transaction_type: newOwner === userAddress ? 'purchase' : 'sale',
              amount: null, // Amount not available in ownership event
              currency: 'BLOCKCHAIN',
              status: 'completed',
              description: `Property ownership ${newOwner === userAddress ? 'purchased' : 'sold'} on blockchain`,
              blockchain_tx_hash: event.transactionHash,
              metadata: {
                event_type: 'OwnershipTransferred',
                property_id: args.propertyId.toString(),
                previous_owner: args.previousOwner,
                new_owner: args.newOwner,
                transfer_type: args.transferType,
                block_number: receipt.blockNumber,
                is_blockchain_only: true
              },
              created_at: new Date(block.timestamp * 1000).toISOString(),
              updated_at: new Date(block.timestamp * 1000).toISOString()
            })
          }
        }
      } catch (error) {
        console.error('Error fetching OwnershipTransferred events:', error)
      }
    }

    // Fetch EscrowCreated and EscrowCompleted events
    if (addresses.Escrow) {
      const ESCROW_ABI = [
        'event EscrowCreated(uint256 indexed transactionId, uint256 indexed propertyId, address indexed buyer, address seller, uint256 amount, bool isTokenPayment)',
        'event EscrowCompleted(uint256 indexed transactionId, address indexed buyer, address indexed seller, uint256 amount)'
      ]
      const escrowContract = new ethers.Contract(addresses.Escrow, ESCROW_ABI, provider)
      
      try {
        const currentBlock = await provider.getBlockNumber()
        const fromBlock = Math.max(0, currentBlock - 10000)
        const userAddress = walletAddress.toLowerCase()

        // Fetch EscrowCreated events
        const createdEvents = await escrowContract.queryFilter(
          escrowContract.filters.EscrowCreated(null, null, null, null, null, null),
          fromBlock,
          'latest'
        )

        for (const event of createdEvents) {
          const args = event.args
          const buyer = args.buyer?.toLowerCase()
          const seller = args.seller?.toLowerCase()
          
          if (buyer === userAddress || seller === userAddress) {
            const receipt = await event.getTransactionReceipt()
            const block = await provider.getBlock(receipt.blockNumber)
            const amount = args.isTokenPayment 
              ? parseFloat(ethers.formatEther(args.amount))
              : parseFloat(ethers.formatEther(args.amount))
            
            blockchainTransactions.push({
              id: `blockchain-escrow-created-${event.transactionHash}-${event.logIndex}`,
              user_id: null,
              property_id: null,
              blockchain_property_id: args.propertyId.toString(),
              transaction_type: buyer === userAddress ? 'purchase' : 'sale',
              amount: amount,
              currency: args.isTokenPayment ? 'PROP' : 'ETH',
              status: 'in_progress',
              description: `Escrow created for property ${args.isTokenPayment ? 'token' : 'ETH'} payment`,
              blockchain_tx_hash: event.transactionHash,
              metadata: {
                event_type: 'EscrowCreated',
                escrow_transaction_id: args.transactionId.toString(),
                property_id: args.propertyId.toString(),
                buyer: args.buyer,
                seller: args.seller,
                amount: args.amount.toString(),
                is_token_payment: args.isTokenPayment,
                block_number: receipt.blockNumber,
                is_blockchain_only: true
              },
              created_at: new Date(block.timestamp * 1000).toISOString(),
              updated_at: new Date(block.timestamp * 1000).toISOString()
            })
          }
        }

        // Fetch EscrowCompleted events
        const completedEvents = await escrowContract.queryFilter(
          escrowContract.filters.EscrowCompleted(null, null, null, null),
          fromBlock,
          'latest'
        )

        for (const event of completedEvents) {
          const args = event.args
          const buyer = args.buyer?.toLowerCase()
          const seller = args.seller?.toLowerCase()
          
          if (buyer === userAddress || seller === userAddress) {
            const receipt = await event.getTransactionReceipt()
            const block = await provider.getBlock(receipt.blockNumber)
            const amount = parseFloat(ethers.formatEther(args.amount))
            
            blockchainTransactions.push({
              id: `blockchain-escrow-completed-${event.transactionHash}-${event.logIndex}`,
              user_id: null,
              property_id: null,
              blockchain_property_id: null,
              transaction_type: buyer === userAddress ? 'purchase' : 'sale',
              amount: amount,
              currency: 'PROP', // EscrowCompleted is typically for token payments
              status: 'completed',
              description: `Escrow completed - ${buyer === userAddress ? 'purchase' : 'sale'} finalized`,
              blockchain_tx_hash: event.transactionHash,
              metadata: {
                event_type: 'EscrowCompleted',
                escrow_transaction_id: args.transactionId.toString(),
                buyer: args.buyer,
                seller: args.seller,
                amount: args.amount.toString(),
                block_number: receipt.blockNumber,
                is_blockchain_only: true
              },
              created_at: new Date(block.timestamp * 1000).toISOString(),
              updated_at: new Date(block.timestamp * 1000).toISOString()
            })
          }
        }
      } catch (error) {
        console.error('Error fetching Escrow events:', error)
      }
    }

    // Sort by created_at descending
    blockchainTransactions.sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    )

    return { data: blockchainTransactions, error: null }
  } catch (error) {
    console.error('Error fetching blockchain transactions:', error)
    return { data: [], error: error.message }
  }
}




