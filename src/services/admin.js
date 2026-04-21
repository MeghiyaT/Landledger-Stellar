import { supabaseStorage as supabase } from '../lib/supabaseStorage'
import {
  notifyRegistrationUnderReview,
  notifyRegistrationApproved,
  notifyRegistrationRejected,
  notifyRegistrationStatusChange,
} from '../utils/notificationHelpers'

/**
 * Get all registrations (admin only)
 * @param {Object} filters - Optional filters (status, limit, offset)
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export const getAllRegistrations = async (filters = {}) => {
  let query = supabase
    .from('registrations')
    .select('*')
    .order('created_at', { ascending: false })

  // Apply filters
  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.limit) {
    query = query.limit(filters.limit)
  }

  if (filters.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1)
  }

  const { data, error } = await query

  return { data, error }
}

/**
 * Get registration by ID (admin only)
 * @param {string} registrationId
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export const getRegistrationById = async (registrationId) => {
  const { data, error } = await supabase
    .from('registrations')
    .select('*')
    .eq('id', registrationId)
    .single()

  return { data, error }
}

/**
 * Update registration status (admin only)
 * @param {string} registrationId
 * @param {string} status - 'pending', 'in_review', 'approved', 'rejected'
 * @param {string} adminUserId - Clerk user ID of the admin
 * @param {string} reviewNotes - Optional notes from admin
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export const updateRegistrationStatus = async (
  registrationId,
  status,
  adminUserId,
  reviewNotes = null
) => {
  const updateData = {
    status,
    reviewed_by: adminUserId,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  if (reviewNotes) {
    updateData.review_notes = reviewNotes
  }

  const { data, error } = await supabase
    .from('registrations')
    .update(updateData)
    .eq('id', registrationId)
    .select()
    .single()

  // Send notifications (don't block on errors)
  if (data && !error) {
    try {
      const userId = data.user_id
      
      // Send email notification
      switch (status) {
        case 'in_review':
          await notifyRegistrationUnderReview(data, userId)
          break
        case 'approved':
          await notifyRegistrationApproved(data, userId)
          break
        case 'rejected':
          await notifyRegistrationRejected(data, userId)
          break
      }
      
      // Send in-app notification
      try {
        console.log('🔔 Creating in-app notification for registration status change:', {
          registrationId: data.id,
          status,
          userId,
          hasReviewNotes: !!reviewNotes
        })
        const notifResult = await notifyRegistrationStatusChange(data, status, userId, reviewNotes)
        if (notifResult?.error) {
          console.error('❌ Failed to create in-app notification:', notifResult.error)
        } else {
          console.log('✅ In-app notification created successfully')
        }
      } catch (notifError) {
        console.error('❌ Error creating in-app notification:', notifError)
      }
      
    } catch (error) {
      console.error('❌ Error sending notifications:', error)
      // Don't fail status update if notifications fail
    }
  }

  return { data, error }
}

/**
 * Approve a registration (admin only)
 * @param {string} registrationId
 * @param {string} adminUserId - Clerk user ID of the admin
 * @param {string} reviewNotes - Optional notes from admin
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export const approveRegistration = async (registrationId, adminUserId, reviewNotes = null) => {
  return updateRegistrationStatus(registrationId, 'approved', adminUserId, reviewNotes)
}

/**
 * Reject a registration (admin only)
 * @param {string} registrationId
 * @param {string} adminUserId - Clerk user ID of the admin
 * @param {string} reviewNotes - Required notes explaining rejection
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export const rejectRegistration = async (registrationId, adminUserId, reviewNotes) => {
  if (!reviewNotes || reviewNotes.trim().length === 0) {
    return {
      data: null,
      error: { message: 'Review notes are required when rejecting a registration' },
    }
  }

  return updateRegistrationStatus(registrationId, 'rejected', adminUserId, reviewNotes)
}

/**
 * Set registration to in_review status (admin only)
 * @param {string} registrationId
 * @param {string} adminUserId - Clerk user ID of the admin
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export const setRegistrationInReview = async (registrationId, adminUserId) => {
  return updateRegistrationStatus(registrationId, 'in_review', adminUserId)
}

/**
 * Get registration statistics (admin only)
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export const getRegistrationStats = async () => {
  try {
    const { data, error } = await supabase
      .from('registrations')
      .select('status')

    if (error) {
      console.error('❌ Error fetching registration stats:', error)
      return { data: null, error }
    }

    if (!data || data.length === 0) {
      console.log('ℹ️ No registrations found for stats')
      return {
        data: {
          total: 0,
          pending: 0,
          in_review: 0,
          approved: 0,
          rejected: 0,
        },
        error: null
      }
    }

    // Count by status (case-insensitive matching)
    const stats = {
      total: data.length,
      pending: data.filter((r) => (r.status || '').toLowerCase() === 'pending').length,
      in_review: data.filter((r) => (r.status || '').toLowerCase() === 'in_review').length,
      approved: data.filter((r) => (r.status || '').toLowerCase() === 'approved').length,
      rejected: data.filter((r) => (r.status || '').toLowerCase() === 'rejected').length,
    }

    console.log('📊 Registration stats calculated:', {
      total: stats.total,
      byStatus: {
        pending: stats.pending,
        in_review: stats.in_review,
        approved: stats.approved,
        rejected: stats.rejected,
      },
      rawStatuses: data.map(r => r.status)
    })

    return { data: stats, error: null }
  } catch (err) {
    console.error('❌ Exception in getRegistrationStats:', err)
    return { data: null, error: err }
  }
}

