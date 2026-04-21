import { supabase } from '../lib/supabase'
import { supabaseStorage } from '../lib/supabaseStorage'

// ---------------------------------------------------------------------------
// Internal helpers (fullstack-developer skill: DRY, modular service layer)
// ---------------------------------------------------------------------------

/**
 * Build a base property query with common visibility filters applied.
 *
 * Public listings must exclude:
 *   - Properties flagged as "removed" via `removed_at` or status 'paused'
 *   - Properties that have already been sold (`sold_at` is not null)
 *
 * We gracefully degrade if the `removed_at` column doesn't yet exist
 * (migration hasn't been run) by falling back to status-only filtering.
 *
 * @param {boolean} includeRemoved - Include paused/removed properties
 * @param {boolean} includeSold    - Include properties already sold
 * @returns Supabase query builder
 */
const buildVisiblePropertiesQuery = (includeRemoved = false, includeSold = false) => {
  let query = supabase.from('properties').select('*')

  if (!includeRemoved) {
    query = query
      .is('removed_at', null)
      .or(includeSold
        ? 'status.is.null,status.eq.active,status.eq.sold,status.eq.rented'
        : 'status.is.null,status.eq.active'
      )
  }

  if (!includeSold) {
    query = query.is('sold_at', null)
  }

  return query
}

/**
 * Apply user-facing filter options (location, type, bedrooms, etc.) to a query.
 *
 * @param {object} query   - Supabase query builder
 * @param {object} filters - Filter options object
 * @returns Supabase query builder
 */
const applyPropertyFilters = (query, filters = {}) => {
  if (filters.listingType) query = query.eq('listing_type', filters.listingType)
  if (filters.location)    query = query.ilike('location', `%${filters.location}%`)
  if (filters.type)        query = query.eq('type', filters.type)
  if (filters.bedrooms)    query = query.gte('bedrooms', parseInt(filters.bedrooms))
  if (filters.bathrooms)   query = query.gte('bathrooms', parseInt(filters.bathrooms))

  if (filters.price) {
    const [min, max] = filters.price.split('-').map((p) => {
      if (p.includes('k')) return parseInt(p.replace('k', '')) * 1000
      return parseInt(p)
    })
    if (min) query = query.gte('price', min)
    if (max) query = query.lte('price', max)
  }

  return query
}

/**
 * Apply sort order to a query.
 *
 * @param {object} query  - Supabase query builder
 * @param {string} sortBy - Sort key
 * @returns Supabase query builder
 */
const applySortOrder = (query, sortBy) => {
  switch (sortBy) {
    case 'price_asc':  return query.order('price', { ascending: true })
    case 'price_desc': return query.order('price', { ascending: false })
    case 'newest':     return query.order('created_at', { ascending: false })
    case 'featured':
      return query
        .order('featured', { ascending: false })
        .order('created_at', { ascending: false })
    default:
      if (sortBy && import.meta.env.DEV) {
        console.warn(`[properties] Unknown sortBy value: "${sortBy}". Falling back to newest-first.`)
      }
      return query.order('created_at', { ascending: false })
  }
}

/**
 * Detect whether an error is caused by a missing DB column (migration not run).
 *
 * @param {object} error - Supabase error object
 * @returns {boolean}
 */
const isMissingColumnError = (error) =>
  error &&
  (error.message?.includes('removed_at') ||
    error.message?.includes('sold_at') ||
    error.message?.includes('sold_to') ||
    error.code === '42703' ||
    error.code === 'PGRST116')

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const getProperties = async (filters = {}) => {
  // Uses buildVisiblePropertiesQuery as the single source of truth for visibility logic
  const runQuery = async (useAdvancedFiltering) => {
    let query = supabase.from('properties').select('*')

    if (useAdvancedFiltering) {
      // Full query with removed_at and sold_at
      query = query
        .is('removed_at', null)
        .is('sold_at', null)
        .or('status.is.null,status.eq.active')
    } else {
      // Basic query for compatibility if columns are missing
      query = query.or('status.is.null,status.eq.active')
    }

    query = applyPropertyFilters(query, filters)
    query = applySortOrder(query, filters.sortBy)

    return query
  }

  let { data, error } = await runQuery(true)

  if (isMissingColumnError(error)) {
    console.log('Detected missing columns (removed_at or sold_at). Falling back to basic filtering.')
    ;({ data, error } = await runQuery(false))
  }

  if (error) {
    console.error('Error in getProperties:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      filters
    })
  } else {
    console.log(`getProperties: Found ${data?.length || 0} properties (filtered out removed/paused)`)
  }

  return { data, error }
}

export const getPropertyById = async (id, includeRemoved = false, includeSold = false) => {
  const runQuery = async (withRemovedAt) => {
    let query = supabase.from('properties').select('*').eq('id', id)

    if (!includeRemoved) {
      if (withRemovedAt) query = query.is('removed_at', null)
      query = query.or(
        includeSold
          ? 'status.is.null,status.eq.active,status.eq.sold,status.eq.rented'
          : 'status.is.null,status.eq.active'
      )
    }

    if (!includeSold) {
      query = query.is('sold_at', null)
    }

    return query.maybeSingle()
  }

  let { data, error } = await runQuery(true)

  if (isMissingColumnError(error)) {
    ({ data, error } = await runQuery(false))
  }

  return { data, error }
}

export const getFeaturedProperties = async (limit = 3) => {
  const runQuery = async (withRemovedAt) => {
    let query = supabase
      .from('properties')
      .select('*')
      .eq('featured', true)
      .is('sold_at', null)
      .or('status.is.null,status.eq.active')
      .limit(limit)
      .order('created_at', { ascending: false })

    if (withRemovedAt) query = query.is('removed_at', null)

    return query
  }

  let { data, error } = await runQuery(true)

  if (isMissingColumnError(error)) {
    ({ data, error } = await runQuery(false))
  }

  return { data, error }
}

export const createProperty = async (propertyData) => {
  const { data, error } = await supabase
    .from('properties')
    .insert(propertyData)
    .select()
    .single()

  return { data, error }
}

export const getUserProperties = async (userId) => {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('user_id', userId)
    .is('sold_at', null)
    .order('created_at', { ascending: false })

  return { data, error }
}

// Get properties purchased by the user
export const getPurchasedProperties = async (userId) => {
  console.log('getPurchasedProperties called with userId:', userId)

  // Check for purchased properties via accepted offers (backward compat)
  const { data: offersData, error: offersError } = await supabase
    .from('property_offers')
    .select(`
      property_id,
      properties (*)
    `)
    .eq('buyer_id', userId)
    .eq('status', 'accepted')
    .eq('offer_type', 'purchase')

  let purchasedFromOffers = []
  if (!offersError && offersData) {
    purchasedFromOffers = offersData
      .map(item => item.properties)
      .filter(Boolean)
      .filter(prop => prop.sold_to === userId || !prop.sold_to)
  }

  // Properties where sold_to matches the user
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('sold_to', userId)
    .not('sold_at', 'is', null)
    .order('sold_at', { ascending: false })

  console.log('getPurchasedProperties result:', {
    dataCount: data?.length || 0,
    offersCount: purchasedFromOffers.length,
    error: error ? {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    } : null,
  })

  const allPurchased = [...(data || []), ...purchasedFromOffers]
  const uniquePurchased = allPurchased.filter((prop, index, self) =>
    index === self.findIndex(p => p.id === prop.id)
  )

  // Fallback: check user_id for completed ownership transfers
  if ((error || !data || data.length === 0) && uniquePurchased.length === 0) {
    console.log('Trying alternative query: checking user_id for completed transactions')
    const { data: userOwnedData, error: userOwnedError } = await supabase
      .from('properties')
      .select('*')
      .eq('user_id', userId)
      .eq('sold_to', userId)
      .not('sold_at', 'is', null)
      .order('sold_at', { ascending: false })

    if (!userOwnedError && userOwnedData && userOwnedData.length > 0) {
      console.log('Found properties via user_id query:', userOwnedData.length)
      const allData = [...uniquePurchased, ...userOwnedData]
      const finalUnique = allData.filter((prop, index, self) =>
        index === self.findIndex(p => p.id === prop.id)
      )
      return { data: finalUnique, error: null }
    }
  }

  return { data: uniquePurchased, error: error && uniquePurchased.length === 0 ? error : null }
}

// Get properties sold by the user (as seller)
export const getSoldProperties = async (userId) => {
  const { data: offersData, error: offersError } = await supabase
    .from('property_offers')
    .select(`
      property_id,
      properties (*)
    `)
    .eq('seller_id', userId)
    .eq('status', 'accepted')
    .eq('offer_type', 'purchase')

  let soldProperties = []
  if (!offersError && offersData) {
    soldProperties = offersData
      .map(item => item.properties)
      .filter(Boolean)
      .filter(prop => (prop.sold_to && prop.sold_to !== userId) || prop.sold_at)
  }

  const uniqueSold = soldProperties.filter((prop, index, self) =>
    index === self.findIndex(p => p.id === prop.id)
  )

  uniqueSold.sort((a, b) => {
    const dateA = a.sold_at ? new Date(a.sold_at) : new Date(0)
    const dateB = b.sold_at ? new Date(b.sold_at) : new Date(0)
    return dateB - dateA
  })

  return { data: uniqueSold, error: offersError && uniqueSold.length === 0 ? offersError : null }
}

export const updateProperty = async (propertyId, updateData) => {
  const { data, error } = await supabase
    .from('properties')
    .update({
      ...updateData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', propertyId)
    .select()
    .single()

  return { data, error }
}

export const incrementViewCount = async (propertyId) => {
  const { data, error } = await supabase.rpc('increment_property_views', {
    property_id: propertyId
  })

  // If RPC doesn't exist, do it manually
  if (error && error.code === '42883') {
    const { data: property } = await supabase
      .from('properties')
      .select('view_count')
      .eq('id', propertyId)
      .single()

    if (property) {
      const newCount = (property.view_count || 0) + 1
      return await supabase
        .from('properties')
        .update({ view_count: newCount })
        .eq('id', propertyId)
    }
  }

  return { data, error }
}

export const deleteProperty = async (propertyId) => {
  console.log('Attempting to delete property:', propertyId)

  const { data: propertyData, error: fetchError } = await supabase
    .from('properties')
    .select('id, user_id, title')
    .eq('id', propertyId)
    .single()

  if (fetchError) {
    console.error('Error fetching property:', fetchError)
    return { data: null, error: fetchError }
  }

  console.log('Property found:', propertyData)

  const { data, error } = await supabase
    .from('properties')
    .delete()
    .eq('id', propertyId)
    .select()

  if (error) {
    console.error('Delete property error:', error)
  } else {
    console.log('Property deleted successfully:', data)
    if (data && data.length === 0) {
      console.warn('Delete returned empty array - RLS may have blocked it')
    }
  }

  return { data, error }
}

// Get all properties (for admin)
export const getAllProperties = async (filters = {}) => {
  const runQuery = async (withRemovedAt) => {
    let query = supabaseStorage.from('properties').select('*')

    if (filters.status) query = query.eq('status', filters.status)
    if (withRemovedAt && filters.includeRemoved !== true) {
      query = query.is('removed_at', null)
    }
    if (filters.listingType) query = query.eq('listing_type', filters.listingType)

    return query.order('created_at', { ascending: false })
  }

  let { data, error } = await runQuery(true)

  if (isMissingColumnError(error)) {
    console.log('removed_at column not found, fetching all properties without filter')
    ;({ data, error } = await runQuery(false))
  }

  if (error) console.error('Error fetching properties:', error)

  return { data, error }
}

// Admin function to remove a property with reason
export const adminRemoveProperty = async (propertyId, adminUserId, reason) => {
  if (!reason || !reason.trim()) {
    return { data: null, error: { message: 'Removal reason is required' } }
  }

  const { data: existingProperty, error: fetchError } = await supabaseStorage
    .from('properties')
    .select('id, user_id, title')
    .eq('id', propertyId)
    .maybeSingle()

  if (fetchError) {
    console.error('Error fetching property:', fetchError)
    return { data: null, error: fetchError }
  }

  if (!existingProperty) {
    return { data: null, error: { message: 'Property not found' } }
  }

  const updateData = {
    status: 'paused',
    updated_at: new Date().toISOString(),
    removed_by: adminUserId,
    removed_at: new Date().toISOString(),
    removal_reason: reason.trim(),
  }

  console.log('Updating property with:', updateData)

  const { data, error } = await supabaseStorage
    .from('properties')
    .update(updateData)
    .eq('id', propertyId)
    .select()
    .maybeSingle()

  console.log('Update response:', { data, error })

  if (error) {
    console.error('Error removing property:', error)

    // If column or RLS issue, retry with status-only
    const isColumnOrRlsError =
      error.code === 'PGRST301' || error.code === '42501' || error.status === 406 ||
      error.message?.includes('removed_at') || error.message?.includes('removed_by') ||
      error.message?.includes('removal_reason') || error.code === '42703'

    if (isColumnOrRlsError) {
      console.log('Retrying with status-only update (RLS or column issue)')
      const { data: retryData, error: retryError } = await supabaseStorage
        .from('properties')
        .update({ status: 'paused', updated_at: new Date().toISOString() })
        .eq('id', propertyId)
        .select()
        .maybeSingle()

      if (retryError) {
        console.error('Retry also failed:', retryError)
        return { data: null, error: retryError }
      }

      console.log('Property removed successfully (status-only update)')
      return { data: retryData, error: null }
    }

    return { data: null, error }
  }

  if (!data) {
    // Verify the update by re-fetching
    const { data: verifyData, error: verifyError } = await supabaseStorage
      .from('properties')
      .select('id, status, removed_at, removed_by, removal_reason')
      .eq('id', propertyId)
      .maybeSingle()

    if (verifyError) {
      return { data: null, error: { message: 'Update may have failed - could not verify' } }
    }

    if (verifyData.status === 'paused' || verifyData.removed_at) {
      return { data: verifyData, error: null }
    }

    return {
      data: null,
      error: { message: 'Update failed - property status unchanged. RLS policy may be blocking the update.' }
    }
  }

  console.log('Property removed successfully:', data)
  return { data, error: null }
}

// Export internal helpers for use in other service modules (e.g., admin.js)
export { buildVisiblePropertiesQuery, applyPropertyFilters, applySortOrder }
