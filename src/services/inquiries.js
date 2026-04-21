import { supabase } from '../lib/supabase'
import { notifyInquiryMessage, notifyInquiryReply } from './notifications'

export const createInquiry = async (inquiryData) => {
  try {
    console.log('Creating inquiry with data:', inquiryData)
    
    // First, try with all fields
    let { data, error } = await supabase
      .from('inquiries')
      .insert(inquiryData)
      .select()
      .single()

    // If error is due to unknown columns (migration not run), retry without optional fields
    if (error && (error.code === '42703' || error.message?.includes('column') || error.message?.includes('does not exist'))) {
      console.warn('Some inquiry columns may not exist, retrying with basic fields only')
      
      // Retry with only required/basic fields
      const basicInquiryData = {
        property_id: inquiryData.property_id,
        user_id: inquiryData.user_id,
        buyer_name: inquiryData.buyer_name,
        buyer_email: inquiryData.buyer_email,
        buyer_phone: inquiryData.buyer_phone || null,
        message: inquiryData.message || null,
      }

      const retryResult = await supabase
        .from('inquiries')
        .insert(basicInquiryData)
        .select()
        .single()

      data = retryResult.data
      error = retryResult.error

      // If successful, try to update with additional fields if they exist
      if (!error && data?.id) {
        const updateData = {}
        if (inquiryData.appointment_date) updateData.appointment_date = inquiryData.appointment_date
        if (inquiryData.appointment_time) updateData.appointment_time = inquiryData.appointment_time
        if (inquiryData.phone_revealed !== undefined) updateData.phone_revealed = inquiryData.phone_revealed
        if (inquiryData.owner_phone) updateData.owner_phone = inquiryData.owner_phone

        if (Object.keys(updateData).length > 0) {
          // Try to update, but don't fail if columns don't exist
          try {
            await supabase
              .from('inquiries')
              .update(updateData)
              .eq('id', data.id)
              .select()
              .single()
          } catch (updateErr) {
            console.warn('Could not update inquiry with additional fields:', updateErr)
            // Don't fail the whole operation if update fails
          }
        }
      }
    }

    if (error) {
      console.error('Inquiry creation failed:', error)
      console.error('Error code:', error.code)
      console.error('Error message:', error.message)
      console.error('Error details:', error.details)
      console.error('Error hint:', error.hint)
    }

    // Create notification for property owner when inquiry is created
    if (!error && data) {
      try {
        // Get property to find owner
        const { data: property } = await supabase
          .from('properties')
          .select('user_id, title')
          .eq('id', inquiryData.property_id)
          .single()

        if (property?.user_id) {
          await notifyInquiryMessage(
            property.user_id,
            property.title || 'Property',
            data.id
          )
        }
      } catch (notifError) {
        console.error('Error creating inquiry notification:', notifError)
        // Don't fail inquiry creation if notification fails
      }
    }

    return { data, error }
  } catch (err) {
    console.error('Unexpected error creating inquiry:', err)
    return { 
      data: null, 
      error: { 
        message: err.message || 'An unexpected error occurred',
        code: err.code || 'UNKNOWN_ERROR'
      } 
    }
  }
}

export const getInquiriesByPropertyId = async (propertyId) => {
  const { data, error } = await supabase
    .from('inquiries')
    .select('*')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })

  return { data, error }
}

export const getInquiriesByUserId = async (userId) => {
  // Get all properties owned by user, then get inquiries for those properties
  const { data: properties, error: propsError } = await supabase
    .from('properties')
    .select('id')
    .eq('user_id', userId)

  if (propsError || !properties || properties.length === 0) {
    return { data: [], error: propsError }
  }

  const propertyIds = properties.map(p => p.id)

  const { data, error } = await supabase
    .from('inquiries')
    .select('*')
    .in('property_id', propertyIds)
    .order('created_at', { ascending: false })

  return { data, error }
}

export const updateInquiryStatus = async (inquiryId, status) => {
  const { data, error } = await supabase
    .from('inquiries')
    .update({ 
      status,
      updated_at: new Date().toISOString()
    })
    .eq('id', inquiryId)
    .select()
    .single()

  return { data, error }
}

export const getUnreadInquiryCount = async (userId) => {
  // Get all properties owned by user
  const { data: properties, error: propsError } = await supabase
    .from('properties')
    .select('id')
    .eq('user_id', userId)

  if (propsError || !properties || properties.length === 0) {
    return { data: 0, error: null }
  }

  const propertyIds = properties.map(p => p.id)

  const { count, error } = await supabase
    .from('inquiries')
    .select('*', { count: 'exact', head: true })
    .in('property_id', propertyIds)
    .eq('status', 'new')

  return { data: count || 0, error }
}

// Reveal phone number to buyer after inquiry
export const revealOwnerPhone = async (inquiryId, ownerPhone) => {
  const { data, error } = await supabase
    .from('inquiries')
    .update({ 
      phone_revealed: true,
      owner_phone: ownerPhone,
      updated_at: new Date().toISOString()
    })
    .eq('id', inquiryId)
    .select()
    .single()

  return { data, error }
}

// Get inquiry with property and owner details
export const getInquiryWithDetails = async (inquiryId) => {
  const { data, error } = await supabase
    .from('inquiries')
    .select(`
      *,
      properties (
        id,
        title,
        user_id
      )
    `)
    .eq('id', inquiryId)
    .single()

  return { data, error }
}

// Get replies for an inquiry
export const getInquiryReplies = async (inquiryId) => {
  const { data, error } = await supabase
    .from('inquiry_replies')
    .select('*')
    .eq('inquiry_id', inquiryId)
    .order('created_at', { ascending: true })

  return { data, error }
}

// Create a reply to an inquiry
export const createInquiryReply = async (replyData) => {
  try {
    console.log('Creating reply with data:', replyData)
    
    const { data, error } = await supabase
      .from('inquiry_replies')
      .insert(replyData)
      .select()
      .single()

    if (error) {
      console.error('Reply creation failed:', error)
      console.error('Error code:', error.code)
      console.error('Error message:', error.message)
      console.error('Error details:', error.details)
      console.error('Error hint:', error.hint)
    }

    // Update inquiry status to 'replied' if owner is replying
    if (!error && replyData.sender_type === 'owner') {
      await updateInquiryStatus(replyData.inquiry_id, 'replied')
    }

    // Create notification for the other party
    if (!error && data) {
      try {
        // Get inquiry to find property and other party
        const { data: inquiry } = await supabase
          .from('inquiries')
          .select('property_id, user_id, properties(title)')
          .eq('id', replyData.inquiry_id)
          .single()

        if (inquiry) {
          // Get property to find owner
          const { data: property } = await supabase
            .from('properties')
            .select('user_id, title')
            .eq('id', inquiry.property_id)
            .single()

          // Determine who to notify
          // If reply is from owner, notify buyer (inquiry.user_id)
          // If reply is from buyer, notify owner (property.user_id)
          const recipientId = replyData.sender_type === 'owner' 
            ? inquiry.user_id 
            : property?.user_id

          if (recipientId) {
            await notifyInquiryReply(
              recipientId,
              property?.title || inquiry.properties?.title || 'Property',
              inquiry.property_id
            )
          }
        }
      } catch (notifError) {
        console.error('Error creating reply notification:', notifError)
        // Don't fail reply creation if notification fails
      }
    }

    return { data, error }
  } catch (err) {
    console.error('Unexpected error creating reply:', err)
    return { 
      data: null, 
      error: { 
        message: err.message || 'An unexpected error occurred',
        code: err.code || 'UNKNOWN_ERROR'
      } 
    }
  }
}




