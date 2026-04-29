import { supabase } from '../lib/supabase'
import { supabaseStorage } from '../lib/supabaseStorage'
import { notifyRegistrationSubmitted } from '../utils/notificationHelpers'

export const createRegistration = async (registrationData, userId) => {
  const { data, error } = await supabase
    .from('registrations')
    .insert({
      ...registrationData,
      user_id: userId,
      status: 'pending',
      estimated_review_days: 5, // Default 5 business days
    })
    .select()
    .single()

  // Send email notification (don't block on errors)
  if (data && !error) {
    try {
      await notifyRegistrationSubmitted(data, userId)
    } catch (emailError) {
      console.error('Error sending email:', emailError)
      // Don't fail registration if email fails
    }
  }

  return { data, error }
}

export const getRegistrations = async (userId, filters = {}) => {
  let query = supabase
    .from('registrations')
    .select('*')
    .eq('user_id', userId)

  // Filter by status if provided
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  query = query.order('created_at', { ascending: false })

  const { data, error } = await query

  return { data, error }
}

// Generate PDF certificate for approved registration
export const generateRegistrationCertificate = async (registrationId, userId) => {
  // First verify the registration belongs to the user and is approved
  const { data: registration, error: fetchError } = await supabase
    .from('registrations')
    .select('*')
    .eq('id', registrationId)
    .eq('user_id', userId)
    .eq('status', 'approved')
    .single()

  if (fetchError || !registration) {
    return { data: null, error: { message: 'Registration not found or not approved' } }
  }

  // In a real implementation, you would generate a PDF here
  // For now, we'll return the registration data that can be used to generate PDF on client side
  return { data: registration, error: null }
}

export const getRegistrationById = async (id, userId) => {
  const { data, error } = await supabase
    .from('registrations')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  return { data, error }
}

export const uploadRegistrationDocument = async (file, registrationId, userId) => {
  const fileExt = file.name.split('.').pop()
  const fileName = `${userId}/${registrationId}/${Math.random()}.${fileExt}`
  const filePath = `registrations/${fileName}`

  const { error: uploadError } = await supabaseStorage.storage
    .from('registration-documents')
    .upload(filePath, file)

  if (uploadError) {
    return { data: null, error: uploadError }
  }

  // Use service role key for getting public URL as well
  const { data: urlData } = supabaseStorage.storage
    .from('registration-documents')
    .getPublicUrl(filePath)

  return { data: { path: filePath, url: urlData.publicUrl }, error: null }
}

export const deleteRegistration = async (registrationId, userId) => {
  const { error } = await supabase
    .from('registrations')
    .delete()
    .eq('id', registrationId)
    .eq('user_id', userId)

  return { error }
}

/**
 * Update a registration (only allowed if status is 'pending')
 * @param {string} registrationId
 * @param {string} userId - Clerk user ID
 * @param {Object} updateData - Registration data to update
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export const updateRegistration = async (registrationId, userId, updateData) => {
  // First, check if registration exists and is pending
  const { data: existing, error: fetchError } = await supabase
    .from('registrations')
    .select('status')
    .eq('id', registrationId)
    .eq('user_id', userId)
    .single()

  if (fetchError) {
    return { data: null, error: fetchError }
  }

  if (existing.status !== 'pending') {
    return {
      data: null,
      error: {
        message: 'Only pending registrations can be edited. Please cancel and resubmit if needed.',
      },
    }
  }

  // Update the registration
  const { data, error } = await supabase
    .from('registrations')
    .update({
      ...updateData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', registrationId)
    .eq('user_id', userId)
    .select()
    .single()

  return { data, error }
}

/**
 * Update registration with blockchain anchoring data
 * @param {string} registrationId
 * @param {string} blockchainId
 * @param {string} txHash
 * @returns {Promise<{data: Object|null, error: Error|null}>}
 */
export const updateRegistrationBlockchainData = async (registrationId, blockchainId, txHash) => {
  const { data, error } = await supabase
    .from('registrations')
    .update({
      blockchain_id: blockchainId,
      blockchain_tx_hash: txHash,
      updated_at: new Date().toISOString(),
    })
    .eq('id', registrationId)
    .select()
    .single()

  return { data, error }
}



