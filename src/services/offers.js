import { supabase } from '../lib/supabase'
import { inrToTokens } from '../utils/tokenConversion'
import { notifyOfferReceived, notifyOfferAccepted, notifyOfferRejected, notifyPropertySold, notifyPropertyPurchased } from './notifications'

// Get offers for a property (for sellers)
export const getOffersByPropertyId = async (propertyId) => {
  const { data, error } = await supabase
    .from('property_offers')
    .select('*')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })

  return { data, error }
}

// Get offers by buyer (for buyers to see their offers)
export const getOffersByBuyerId = async (buyerId) => {
  const { data, error } = await supabase
    .from('property_offers')
    .select(`
      *,
      properties (
        id,
        title,
        location,
        price,
        images,
        listing_type
      )
    `)
    .eq('buyer_id', buyerId)
    .order('created_at', { ascending: false })

  return { data, error }
}

// Get offers by seller (for sellers to see all offers on their properties)
export const getOffersBySellerId = async (sellerId) => {
  const { data, error } = await supabase
    .from('property_offers')
    .select(`
      *,
      properties (
        id,
        title,
        location,
        price,
        images,
        listing_type
      )
    `)
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })

  return { data, error }
}

// Create a new offer (with blockchain integration)
export const createOffer = async (offerData) => {
  try {
    console.log('Creating offer with data:', offerData)
    
    // In our new Stellar model, offers begin securely in Supabase.
    // Escrow/Payment happens later when the buyer initiates payment via Dashboard.
    let blockchainOfferId = null
    let blockchainTxHash = null
    
    // Create offer in Supabase (always happens)
    const offerDataWithBlockchain = {
      ...offerData,
      blockchain_tx_hash: blockchainTxHash || null,
      blockchain_offer_id: blockchainOfferId || null,
    }
    
    const { data, error } = await supabase
      .from('property_offers')
      .insert(offerDataWithBlockchain)
      .select()
      .single()

    // Create notification for property owner
    if (!error && data) {
      try {
        const { data: property } = await supabase
          .from('properties')
          .select('title')
          .eq('id', offerData.property_id)
          .single()

        if (property?.title && offerData.seller_id) {
          await notifyOfferReceived(
            offerData.seller_id,
            property.title,
            offerData.offer_amount,
            data.id
          )
        }
      } catch (notifError) {
        console.error('Error creating offer notification:', notifError)
        // Don't fail offer creation if notification fails
      }
    }

    if (error) {
      console.error('Offer creation failed:', error)
      console.error('Error code:', error.code)
      console.error('Error message:', error.message)
      console.error('Error details:', error.details)
      console.error('Error hint:', error.hint)
    }

    return { data, error }
  } catch (err) {
    console.error('Unexpected error creating offer:', err)
    return { 
      data: null, 
      error: { 
        message: err.message || 'An unexpected error occurred',
        code: err.code || 'UNKNOWN_ERROR'
      } 
    }
  }
}

// Update offer status (accept, reject, withdraw)
export const updateOfferStatus = async (offerId, status, userId) => {
  // First get the offer to verify permissions
  const { data: offer, error: fetchError } = await supabase
    .from('property_offers')
    .select('*')
    .eq('id', offerId)
    .single()

  if (fetchError || !offer) {
    return { data: null, error: fetchError || { message: 'Offer not found' } }
  }

  // Verify user has permission (seller for accept/reject, buyer for withdraw)
  if (status === 'withdrawn' && offer.buyer_id !== userId) {
    return { data: null, error: { message: 'Only the buyer can withdraw an offer' } }
  }

  if ((status === 'accepted' || status === 'rejected') && offer.seller_id !== userId) {
    return { data: null, error: { message: 'Only the seller can accept or reject an offer' } }
  }

  const { data, error } = await supabase
    .from('property_offers')
    .update({ 
      status,
      updated_at: new Date().toISOString()
    })
    .eq('id', offerId)
    .select()
    .single()

  // Create notification for rejected offers
  if (!error && data && status === 'rejected' && offer.buyer_id) {
    try {
      const { data: property } = await supabase
        .from('properties')
        .select('title')
        .eq('id', offer.property_id)
        .single()

      await notifyOfferRejected(
        offer.buyer_id,
        property?.title || 'Property',
        offerId
      )
    } catch (notifError) {
      console.error('Error creating offer rejected notification:', notifError)
    }
  }

  return { data, error }
}

// Accept offer and create transaction
export const acceptOfferAndCreateTransaction = async (offerId, userId) => {
  try {
    // First get the offer with property details
    const { data: offer, error: fetchError } = await supabase
      .from('property_offers')
      .select(`
        *,
        properties (
          id,
          title,
          location,
          address,
          price,
          listing_type
        )
      `)
      .eq('id', offerId)
      .single()

    if (fetchError || !offer) {
      return { data: null, error: fetchError || { message: 'Offer not found' } }
    }

    // Verify user is the seller
    if (offer.seller_id !== userId) {
      return { data: null, error: { message: 'Only the seller can accept an offer' } }
    }

    // Update offer status to accepted
    const { data: updatedOffer, error: updateError } = await supabase
      .from('property_offers')
      .update({ 
        status: 'accepted',
        updated_at: new Date().toISOString()
      })
      .eq('id', offerId)
      .select()
      .single()

    if (updateError) {
      return { data: null, error: updateError }
    }

    // Create notification for buyer
    if (updatedOffer && offer.buyer_id) {
      try {
        await notifyOfferAccepted(
          offer.buyer_id,
          offer.properties?.title || 'Property',
          offerId
        )
      } catch (notifError) {
        console.error('Error creating offer accepted notification:', notifError)
      }
    }

    // If this is a purchase offer (not rental), transfer property ownership
    if (offer.offer_type === 'purchase') {
      console.log('Transferring property ownership to buyer:', offer.buyer_id)
      const { error: propertyUpdateError } = await supabase
        .from('properties')
        .update({
          sold_at: new Date().toISOString(),
          sold_to: offer.buyer_id,
          status: 'sold', // Mark as sold
          updated_at: new Date().toISOString()
        })
        .eq('id', offer.property_id)

      if (propertyUpdateError) {
        console.error('Error transferring property ownership:', propertyUpdateError)
        // Don't fail the offer acceptance if property update fails, but log it
        // The transaction creation should still proceed
      } else {
        console.log('Property ownership transferred successfully')
        
        // Notify seller about property sold
        if (offer.seller_id) {
          try {
            await notifyPropertySold(
              offer.seller_id,
              offer.properties?.title || 'Property',
              offer.property_id
            )
          } catch (notifError) {
            console.error('Error creating property sold notification:', notifError)
          }
        }

        // Notify buyer about property purchased
        if (offer.buyer_id) {
          try {
            await notifyPropertyPurchased(
              offer.buyer_id,
              offer.properties?.title || 'Property',
              offer.property_id
            )
          } catch (notifError) {
            console.error('Error creating property purchased notification:', notifError)
          }
        }
      }
      
      // Remove property from buyer's saved properties (if saved)
      // This ensures purchased properties don't appear in favorites
      const { error: removeSavedError } = await supabase
        .from('saved_properties')
        .delete()
        .eq('user_id', offer.buyer_id)
        .eq('property_id', offer.property_id)
      
      if (removeSavedError) {
        console.error('Error removing property from saved properties:', removeSavedError)
        // Don't fail the offer acceptance if this fails, just log it
      } else {
        console.log('Removed purchased property from saved properties')
      }
    }

    // We intentionally DO NOT create the escrow here, because the SELLER is accepting the offer.
    // The buyer will explicitly create the escrow (depositing XLM) from their Dashboard later.
    let escrowData = null

    // Create transaction for buyer
    const buyerTransaction = {
      user_id: offer.buyer_id,
      property_id: offer.property_id,
      transaction_type: offer.offer_type === 'purchase' ? 'purchase' : 'rental',
      amount: offer.offer_amount,
      currency: escrowData ? 'PROP' : (offer.currency || 'INR'), // Use PROP if escrow created
      status: escrowData ? 'in_progress' : 'pending', // In progress if escrow created
      description: `Property ${offer.offer_type === 'purchase' ? 'purchase' : 'rental'}: ${offer.properties?.title || 'Property'}`,
      blockchain_tx_hash: escrowData?.escrow_tx_hash || null,
      metadata: {
        offer_id: offerId,
        property_title: offer.properties?.title,
        property_location: offer.properties?.location,
        offer_message: offer.message,
        buyer_id: offer.buyer_id,
        seller_id: offer.seller_id,
        transaction_flow: 'offer_accepted',
        ...(escrowData && {
          escrow_transaction_id: escrowData.escrow_transaction_id,
          escrow_type: escrowData.escrow_type,
          payment_method: 'token'
        })
      }
    }

    const { data: buyerTx, error: buyerTxError } = await supabase
      .from('transactions')
      .insert(buyerTransaction)
      .select()
      .single()

    if (buyerTxError) {
      console.error('Error creating buyer transaction:', buyerTxError)
      console.error('Buyer transaction data:', buyerTransaction)
      console.error('Error code:', buyerTxError.code)
      console.error('Error message:', buyerTxError.message)
      console.error('Error details:', buyerTxError.details)
      console.error('Error hint:', buyerTxError.hint)
      // Continue even if buyer transaction fails - seller transaction might still work
    } else {
      console.log('Buyer transaction created successfully:', buyerTx)
    }

    // Create transaction for seller
    const sellerTransaction = {
      user_id: offer.seller_id,
      property_id: offer.property_id,
      transaction_type: offer.offer_type === 'purchase' ? 'sale' : 'rental',
      amount: offer.offer_amount,
      currency: escrowData ? 'PROP' : (offer.currency || 'INR'), // Use PROP if escrow created
      status: escrowData ? 'in_progress' : 'pending', // In progress if escrow created
      description: `Property ${offer.offer_type === 'purchase' ? 'sale' : 'rental'}: ${offer.properties?.title || 'Property'}`,
      blockchain_tx_hash: escrowData?.escrow_tx_hash || null,
      metadata: {
        offer_id: offerId,
        property_title: offer.properties?.title,
        property_location: offer.properties?.location,
        buyer_id: offer.buyer_id,
        seller_id: offer.seller_id,
        transaction_flow: 'offer_accepted',
        ...(escrowData && {
          escrow_transaction_id: escrowData.escrow_transaction_id,
          escrow_type: escrowData.escrow_type,
          payment_method: 'token'
        })
      }
    }

    const { data: sellerTx, error: sellerTxError } = await supabase
      .from('transactions')
      .insert(sellerTransaction)
      .select()
      .single()

    if (sellerTxError) {
      console.error('Error creating seller transaction:', sellerTxError)
      console.error('Seller transaction data:', sellerTransaction)
      console.error('Error code:', sellerTxError.code)
      console.error('Error message:', sellerTxError.message)
      console.error('Error details:', sellerTxError.details)
      console.error('Error hint:', sellerTxError.hint)
      // Continue even if seller transaction fails - offer is still accepted
    } else {
      console.log('Seller transaction created successfully:', sellerTx)
    }

    // If both transactions failed, return an error
    if (buyerTxError && sellerTxError) {
      return { 
        data: { offer: updatedOffer }, 
        error: { 
          message: 'Offer accepted but failed to create transactions. Please check RLS policies or contact support.',
          transactionErrors: { buyer: buyerTxError, seller: sellerTxError }
        } 
      }
    }

    // Log success
    console.log('Offer accepted and transactions created:', {
      offer: updatedOffer,
      buyerTransaction: buyerTx,
      sellerTransaction: sellerTx
    })

    return { 
      data: { 
        offer: updatedOffer, 
        buyerTransaction: buyerTx, 
        sellerTransaction: sellerTx 
      }, 
      error: null 
    }
  } catch (err) {
    console.error('Error accepting offer and creating transaction:', err)
    return { 
      data: null, 
      error: { 
        message: err.message || 'An unexpected error occurred',
        code: err.code || 'UNKNOWN_ERROR'
      } 
    }
  }
}

// Get a single offer by ID
export const getOfferById = async (offerId) => {
  const { data, error } = await supabase
    .from('property_offers')
    .select(`
      *,
      properties (
        id,
        title,
        location,
        price,
        images,
        listing_type,
        user_id
      )
    `)
    .eq('id', offerId)
    .single()

  return { data, error }
}
