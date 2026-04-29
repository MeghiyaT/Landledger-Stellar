import { supabase } from '../lib/supabase'
import { supabaseStorage } from '../lib/supabaseStorage'

const getProfileClient = () => supabase

export const updateUserProfile = async (userId, profileData) => {
  const client = getProfileClient()

  try {
    const { data, error } = await client
      .from('profiles')
      .upsert({
        id: userId,
        ...profileData,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Profile update error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        client: 'regular'
      })
    }

    return { data, error }
  } catch (err) {
    console.error('❌ Profile update exception:', err)
    return { data: null, error: { message: err.message || 'Unknown error' } }
  }
}

export const getUserProfile = async (userId) => {
  const client = getProfileClient()

  try {
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle() // Use maybeSingle() to handle missing profiles gracefully

    if (error && error.code !== 'PGRST116') {
      console.error('❌ Profile fetch error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        statusCode: error.statusCode,
        fullError: error,
        clientUsed: 'regular'
      })
    }

    return { data, error }
  } catch (err) {
    console.error('❌ Profile fetch exception:', err)
    return { data: null, error: { message: err.message || 'Unknown error', originalError: err } }
  }
}

export const saveProperty = async (userId, propertyId) => {
  console.log('Saving property:', { userId, propertyId })
  const { data, error } = await supabase
    .from('saved_properties')
    .insert({
      user_id: userId,
      property_id: propertyId,
    })
    .select()
    .single()

  if (error) {
    console.error('Error saving property:', error)
  }
  return { data, error }
}

export const getSavedProperties = async (userId) => {
  const { data, error } = await supabase
    .from('saved_properties')
    .select(`
      *,
      properties (*)
    `)
    .eq('user_id', userId)

  return { data, error }
}

export const removeSavedProperty = async (userId, propertyId) => {
  console.log('Removing saved property:', { userId, propertyId })
  const { error } = await supabase
    .from('saved_properties')
    .delete()
    .eq('user_id', userId)
    .eq('property_id', propertyId)

  if (error) {
    console.error('Error removing saved property:', error)
  }
  return { error }
}

/**
 * Upload a profile document (Aadhar Card or PAN Card) to Supabase storage
 * @param {File} file - The file to upload
 * @param {string} userId - Clerk user ID
 * @param {string} documentType - 'aadhar' or 'pan'
 * @returns {Promise<{data: {path: string, url: string}|null, error: Error|null}>}
 */
export const uploadProfileDocument = async (file, userId, documentType) => {
  const fileExt = file.name.split('.').pop()
  const fileName = `${userId}/${documentType}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
  const filePath = `profile-documents/${fileName}`

  const { error: uploadError } = await supabaseStorage.storage
    .from('registration-documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (uploadError) {
    console.error('❌ Upload error:', uploadError)
    // Check if bucket doesn't exist
    if (uploadError.message?.includes('Bucket not found') || uploadError.error === 'Bucket not found') {
      return { 
        data: null, 
        error: { 
          message: 'Storage bucket "registration-documents" not found. Please create it in Supabase Dashboard → Storage.',
          code: 'BUCKET_NOT_FOUND'
        } 
      }
    }
    return { data: null, error: uploadError }
  }

  // Use service role key for getting public URL as well
  const { data: urlData } = supabaseStorage.storage
    .from('registration-documents')
    .getPublicUrl(filePath)

  if (!urlData?.publicUrl) {
    return { 
      data: null, 
      error: { message: 'Failed to generate public URL. Check bucket settings.' } 
    }
  }

  return { data: { path: filePath, url: urlData.publicUrl }, error: null }
}

export const getWalletAddresses = async (profileIds = []) => {
  const uniqueIds = [...new Set(profileIds.filter(Boolean))]

  if (uniqueIds.length === 0) {
    return { data: {}, error: null }
  }

  const { data, error } = await supabase.rpc('get_wallet_addresses', {
    profile_ids: uniqueIds,
  })

  if (error) {
    return { data: null, error }
  }

  const wallets = (data || []).reduce((acc, row) => {
    if (row?.id) {
      acc[row.id] = row.wallet_address || null
    }
    return acc
  }, {})

  return { data: wallets, error: null }
}


