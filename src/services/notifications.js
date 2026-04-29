import { supabase } from '../lib/supabase'

/**
 * Notification types:
 * - 'inquiry_message': New inquiry message received
 * - 'inquiry_reply': Reply to inquiry
 * - 'property_sold': Property sold notification
 * - 'property_purchased': Property purchased notification
 * - 'property_blockchain': Property registered on blockchain
 * - 'amount_deducted': Tokens deducted from account
 * - 'amount_received': Tokens received in account
 * - 'offer_received': New offer on property
 * - 'offer_accepted': Offer accepted
 * - 'offer_rejected': Offer rejected
 * - 'transaction_completed': Transaction completed
 * - 'transaction_failed': Transaction failed
 */

/**
 * Create a notification
 * @param {string} userId - User ID (Clerk user ID)
 * @param {string} type - Notification type
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} link - Optional link to related resource
 * @returns {Promise<{data: object, error: object}>}
 */
export const createNotification = async (userId, type, title, message, link = null) => {
  try {
    console.log('🔔 Creating notification:', { userId, type, title })
    
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        link,
        read: false,
      })
    const data = null // Don't SELECT back — the inserting user may not own the notification (e.g. buyer notifying owner)

    if (error) {
      console.error('❌ Notification creation failed:', {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        userId,
        type
      })
      return { data: null, error }
    }

    console.log('✅ Notification created successfully:', data?.id)
    return { data, error: null }
  } catch (err) {
    console.error('❌ Exception creating notification:', err)
    return {
      data: null,
      error: { message: err.message || 'Failed to create notification' }
    }
  }
}

/**
 * Get notifications for a user
 * @param {string} userId - User ID
 * @param {object} options - Query options
 * @returns {Promise<{data: array, error: object}>}
 */
export const getNotifications = async (userId, options = {}) => {
  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (options.unreadOnly) {
      query = query.eq('read', false)
    }

    if (options.limit) {
      query = query.limit(options.limit)
    }

    const { data, error } = await query

    return { data, error }
  } catch (err) {
    console.error('Error fetching notifications:', err)
    return {
      data: null,
      error: { message: err.message || 'Failed to fetch notifications' }
    }
  }
}

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for verification)
 * @returns {Promise<{data: object, error: object}>}
 */
export const markNotificationAsRead = async (notificationId, userId) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', notificationId)
      .eq('user_id', userId)
      .select()
      .single()

    return { data, error }
  } catch (err) {
    console.error('Error marking notification as read:', err)
    return {
      data: null,
      error: { message: err.message || 'Failed to mark notification as read' }
    }
  }
}

/**
 * Mark all notifications as read
 * @param {string} userId - User ID
 * @returns {Promise<{data: object, error: object}>}
 */
export const markAllNotificationsAsRead = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('read', false)
      .select()

    return { data, error }
  } catch (err) {
    console.error('Error marking all notifications as read:', err)
    return {
      data: null,
      error: { message: err.message || 'Failed to mark all notifications as read' }
    }
  }
}

/**
 * Delete a notification
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for verification)
 * @returns {Promise<{data: object, error: object}>}
 */
export const deleteNotification = async (notificationId, userId) => {
  try {
    // Note: no .select().single() — DELETE returns nothing by default in PostgREST,
    // adding .single() causes 406 Not Acceptable when no matching row is found.
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', userId)

    return { data: null, error }
  } catch (err) {
    console.error('Error deleting notification:', err)
    return {
      data: null,
      error: { message: err.message || 'Failed to delete notification' }
    }
  }
}

/**
 * Delete all notifications older than N days for a user
 */
export const deleteOldNotifications = async (userId, days = 15) => {
  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)
      .lt('created_at', cutoff.toISOString())
    return { error }
  } catch (err) {
    return { error: { message: err.message } }
  }
}

/**
 * Get unread notification count
 * @param {string} userId - User ID
 * @returns {Promise<{data: number, error: object}>}
 */
export const getUnreadNotificationCount = async (userId) => {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false)

    return { data: count || 0, error }
  } catch (err) {
    console.error('Error getting unread notification count:', err)
    return {
      data: 0,
      error: { message: err.message || 'Failed to get unread count' }
    }
  }
}

/**
 * Notification helper functions for specific events
 */

// Inquiry message notification
export const notifyInquiryMessage = async (userId, propertyTitle, inquiryId) => {
  return await createNotification(
    userId,
    'inquiry_message',
    'New Inquiry Message',
    `You have a new inquiry message for "${propertyTitle}"`,
    `/properties/${inquiryId}`
  )
}

// Inquiry reply notification
export const notifyInquiryReply = async (userId, propertyTitle, inquiryId) => {
  return await createNotification(
    userId,
    'inquiry_reply',
    'Inquiry Reply Received',
    `You received a reply to your inquiry about "${propertyTitle}"`,
    `/properties/${inquiryId}`
  )
}

// Property sold notification
export const notifyPropertySold = async (userId, propertyTitle, propertyId) => {
  return await createNotification(
    userId,
    'property_sold',
    'Property Sold!',
    `Congratulations! Your property "${propertyTitle}" has been sold.`,
    `/properties/${propertyId}`
  )
}

// Property purchased notification
export const notifyPropertyPurchased = async (userId, propertyTitle, propertyId) => {
  return await createNotification(
    userId,
    'property_purchased',
    'Property Purchased!',
    `Congratulations! You have successfully purchased "${propertyTitle}".`,
    `/properties/${propertyId}`
  )
}

// Property registered on blockchain
export const notifyPropertyBlockchain = async (userId, propertyTitle, propertyId, txHash) => {
  return await createNotification(
    userId,
    'property_blockchain',
    'Property Registered on Blockchain',
    `Your property "${propertyTitle}" has been successfully registered on the blockchain.`,
    txHash ? `https://stellar.expert/explorer/testnet/tx/${txHash}` : `/properties/${propertyId}`
  )
}

// Amount deducted notification
export const notifyAmountDeducted = async (userId, amount, reason, txHash = null) => {
  return await createNotification(
    userId,
    'amount_deducted',
    'Tokens Deducted',
    `${parseFloat(amount).toLocaleString('en-IN', { maximumFractionDigits: 4 })} XLM tokens were deducted. ${reason}`,
    txHash ? `https://stellar.expert/explorer/testnet/tx/${txHash}` : '/dashboard?tab=transactions'
  )
}

// Amount received notification
export const notifyAmountReceived = async (userId, amount, reason, txHash = null) => {
  return await createNotification(
    userId,
    'amount_received',
    'Tokens Received',
    `You received ${parseFloat(amount).toLocaleString('en-IN', { maximumFractionDigits: 4 })} XLM tokens. ${reason}`,
    txHash ? `https://stellar.expert/explorer/testnet/tx/${txHash}` : '/dashboard?tab=transactions'
  )
}

// Offer received notification
export const notifyOfferReceived = async (userId, propertyTitle, offerAmount, _offerId) => {
  return await createNotification(
    userId,
    'offer_received',
    'New Offer Received',
    `You received a new offer of ₹${parseFloat(offerAmount).toLocaleString('en-IN')} for "${propertyTitle}"`,
    `/dashboard?tab=property offers`
  )
}

// Offer accepted notification
export const notifyOfferAccepted = async (userId, propertyTitle, _offerId) => {
  return await createNotification(
    userId,
    'offer_accepted',
    'Offer Accepted',
    `Your offer for "${propertyTitle}" has been accepted!`,
    `/dashboard?tab=my offers`
  )
}

// Offer rejected notification
export const notifyOfferRejected = async (userId, propertyTitle, _offerId) => {
  return await createNotification(
    userId,
    'offer_rejected',
    'Offer Rejected',
    `Your offer for "${propertyTitle}" was rejected.`,
    `/dashboard?tab=my offers`
  )
}

// Transaction completed notification
export const notifyTransactionCompleted = async (userId, transactionType, amount, _transactionId) => {
  const typeText = transactionType === 'sale' ? 'sale' : transactionType === 'purchase' ? 'purchase' : 'transaction'
  return await createNotification(
    userId,
    'transaction_completed',
    'Transaction Completed',
    `Your ${typeText} transaction has been completed. Amount: ${amount}`,
    `/dashboard?tab=transactions`
  )
}




