import { supabaseStorage } from '../lib/supabaseStorage'

/**
 * Check if the current user is an admin
 * @param {string} userId - Clerk user ID
 * @returns {Promise<boolean>} - True if user is admin
 */
export const isAdmin = async (userId) => {
  if (!userId) return false

  try {
    const { data, error } = await supabaseStorage
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .maybeSingle() // Use maybeSingle() instead of single() to handle missing rows gracefully

    // If no profile exists, user is not admin (this is normal for new users)
    if (error) {
      // PGRST116 means "no rows found" - this is expected if user doesn't have a profile yet
      if (error.code === 'PGRST116') {
        // User doesn't have a profile yet - not an error, just return false
        return false
      }
      // Other errors should be logged
      console.error('Error checking admin status:', error)
      return false
    }

    // If no data returned, user doesn't have a profile
    if (!data) {
      return false
    }

    return data.is_admin === true
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}

/**
 * Get admin status for multiple users (for admin dashboard)
 * @param {string[]} userIds - Array of Clerk user IDs
 * @returns {Promise<Object>} - Map of userId -> isAdmin
 */
export const getAdminStatuses = async (userIds) => {
  if (!userIds || userIds.length === 0) return {}

  try {
    const { data, error } = await supabaseStorage
      .from('profiles')
      .select('id, is_admin')
      .in('id', userIds)

    if (error) {
      console.error('Error fetching admin statuses:', error)
      return {}
    }

    const statusMap = {}
    data?.forEach((profile) => {
      statusMap[profile.id] = profile.is_admin === true
    })

    return statusMap
  } catch (error) {
    console.error('Error fetching admin statuses:', error)
    return {}
  }
}

