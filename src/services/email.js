/**
 * Email Notification Service with Resend Integration
 * 
 * This service handles sending email notifications using Resend.
 * 
 * SETUP:
 * 1. Sign up at https://resend.com
 * 2. Get your API key from Resend dashboard
 * 3. Add to .env: VITE_RESEND_API_KEY=re_your_key_here
 * 4. Add to .env: VITE_EMAIL_FROM=onboarding@resend.dev (or your verified domain)
 * 5. Add to .env: VITE_EMAIL_ENABLED=true
 */

import { Resend } from 'resend'

const EMAIL_ENABLED = import.meta.env.VITE_EMAIL_ENABLED === 'true'
const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY || ''
const EMAIL_FROM = import.meta.env.VITE_EMAIL_FROM || 'onboarding@resend.dev'




// Initialize Resend client (only if API key is provided)
let resend = null
if (RESEND_API_KEY && EMAIL_ENABLED) {
  try {
    resend = new Resend(RESEND_API_KEY)
    console.log('✅ Resend client initialized successfully')
  } catch (error) {
    console.error('❌ Failed to initialize Resend:', error)
  }
} else {
  if (!EMAIL_ENABLED) {
    console.warn('⚠️ Email is disabled (VITE_EMAIL_ENABLED is not "true")')
  }
  if (!RESEND_API_KEY) {
    console.warn('⚠️ Resend API key not found (VITE_RESEND_API_KEY is missing)')
  }
}

/**
 * Send email notification using Resend
 * @param {Object} emailData - { to, subject, html, text, from (optional) }
 * @returns {Promise<{success: boolean, error: Error|null, data: Object|null}>}
 */
export const sendEmail = async (emailData) => {
  if (!EMAIL_ENABLED) {
    console.log('📧 Email (disabled):', {
      to: emailData.to,
      subject: emailData.subject,
    })
    return { success: true, error: null, data: null }
  }

  if (!RESEND_API_KEY) {
    console.warn('⚠️ Resend API key not configured. Emails will not be sent.')
    console.log('📧 Email would be sent:', {
      to: emailData.to,
      subject: emailData.subject,
    })
    return { success: false, error: new Error('Resend API key not configured'), data: null }
  }

  if (!resend) {
    return { 
      success: false, 
      error: new Error('Resend client not initialized'), 
      data: null 
    }
  }

  try {
    // Use Supabase Edge Function if available (avoids CORS issues)
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
    
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      // Try to use Edge Function first (recommended)
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            to: emailData.to,
            subject: emailData.subject,
            html: emailData.html,
            text: emailData.text || emailData.html?.replace(/<[^>]*>/g, ''),
            from: emailData.from || EMAIL_FROM,
          }),
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            console.log('✅ Email sent successfully via Edge Function:', {
              to: emailData.to,
              subject: emailData.subject,
              id: result.data?.id,
            })
            return { success: true, error: null, data: result.data }
          } else {
            // Edge function returned error
            const errorMsg = result.error?.message || result.error || 'Email sending failed'
            console.error('❌ Edge Function error:', errorMsg)
            throw new Error(errorMsg)
          }
        } else {
          // Edge function returned non-200 status
          const errorText = await response.text().catch(() => 'Unknown error')
          console.error(`❌ Edge Function returned ${response.status}:`, errorText)
          throw new Error(`Edge Function error: ${response.status} - ${errorText}`)
        }
      } catch (edgeError) {
        // Edge function not available or failed, fall back to direct Resend
        console.warn('⚠️ Edge Function error, falling back to direct Resend:', edgeError.message)
        console.warn('💡 Check Edge Function logs in Supabase Dashboard for details')
      }
    }

    // Fallback: Direct Resend call (will have CORS issues in browser)
    // This only works if Resend allows CORS or if running in Node.js
    const result = await resend.emails.send({
      from: emailData.from || EMAIL_FROM,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text || emailData.html?.replace(/<[^>]*>/g, ''), // Fallback text from HTML
    })

    if (result.error) {
      console.error('Resend API error:', result.error)
      return { success: false, error: result.error, data: null }
    }

    console.log('✅ Email sent successfully:', {
      to: emailData.to,
      subject: emailData.subject,
      id: result.data?.id,
    })

    return { success: true, error: null, data: result.data }
  } catch (error) {
    console.error('Error sending email via Resend:', error)
    // Check if it's a CORS error
    if (error.message?.includes('CORS') || error.message?.includes('fetch')) {
      console.error('❌ CORS Error: Resend API cannot be called directly from browser.')
      console.error('💡 Solution: Deploy the Supabase Edge Function (see RESEND_SETUP.md)')
    }
    return { success: false, error, data: null }
  }
}

/**
 * Send registration submitted email
 * @param {Object} data - { email, ownerName, propertyAddress, registrationId }
 */
export const sendRegistrationSubmittedEmail = async (data) => {
  const subject = 'Land Registration Submitted Successfully'
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9fafb; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Registration Submitted</h1>
        </div>
        <div class="content">
          <p>Dear ${data.ownerName},</p>
          <p>Thank you for submitting your land registration for <strong>${data.propertyAddress}</strong>.</p>
          <p>Your registration has been received and is currently pending review. Our team typically reviews registrations within <strong>3-5 business days</strong>.</p>
          <p>You will receive an email notification once your registration has been reviewed.</p>
          <p>Registration ID: <strong>${data.registrationId}</strong></p>
          <a href="${window.location.origin}/dashboard" class="button">View Dashboard</a>
        </div>
        <div class="footer">
          <p>This is an automated message from LandLedger. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `

  return sendEmail({
    to: data.email,
    subject,
    html,
    text: `Dear ${data.ownerName},\n\nThank you for submitting your land registration for ${data.propertyAddress}.\n\nYour registration has been received and is currently pending review. Our team typically reviews registrations within 3-5 business days.\n\nYou will receive an email notification once your registration has been reviewed.\n\nRegistration ID: ${data.registrationId}\n\nView your dashboard: ${window.location.origin}/dashboard`,
  })
}

/**
 * Send registration under review email
 * @param {Object} data - { email, ownerName, propertyAddress, registrationId }
 */
export const sendRegistrationUnderReviewEmail = async (data) => {
  const subject = 'Your Registration is Under Review'
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9fafb; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Registration Under Review</h1>
        </div>
        <div class="content">
          <p>Dear ${data.ownerName},</p>
          <p>Your land registration for <strong>${data.propertyAddress}</strong> is now under review by our team.</p>
          <p>We will notify you once the review is complete. This typically takes 1-2 business days.</p>
          <p>Registration ID: <strong>${data.registrationId}</strong></p>
          <a href="${window.location.origin}/dashboard" class="button">View Status</a>
        </div>
        <div class="footer">
          <p>This is an automated message from LandLedger. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `

  return sendEmail({
    to: data.email,
    subject,
    html,
    text: `Dear ${data.ownerName},\n\nYour land registration for ${data.propertyAddress} is now under review by our team.\n\nWe will notify you once the review is complete. This typically takes 1-2 business days.\n\nRegistration ID: ${data.registrationId}\n\nView status: ${window.location.origin}/dashboard`,
  })
}

/**
 * Send registration approved email
 * @param {Object} data - { email, ownerName, propertyAddress, registrationId, reviewNotes }
 */
export const sendRegistrationApprovedEmail = async (data) => {
  const subject = 'Your Registration Has Been Approved!'
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #10b981; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9fafb; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
        .notes { background-color: #e0f2fe; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Registration Approved</h1>
        </div>
        <div class="content">
          <p>Dear ${data.ownerName},</p>
          <p>Great news! Your land registration for <strong>${data.propertyAddress}</strong> has been <strong>approved</strong>.</p>
          ${data.reviewNotes ? `<div class="notes"><strong>Review Notes:</strong><br>${data.reviewNotes}</div>` : ''}
          <p>Your registration is now complete and has been processed successfully.</p>
          <p>Registration ID: <strong>${data.registrationId}</strong></p>
          <a href="${window.location.origin}/dashboard" class="button">View Registration</a>
        </div>
        <div class="footer">
          <p>This is an automated message from LandLedger. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `

  return sendEmail({
    to: data.email,
    subject,
    html,
    text: `Dear ${data.ownerName},\n\nGreat news! Your land registration for ${data.propertyAddress} has been approved.\n\n${data.reviewNotes ? `Review Notes: ${data.reviewNotes}\n\n` : ''}Your registration is now complete and has been processed successfully.\n\nRegistration ID: ${data.registrationId}\n\nView registration: ${window.location.origin}/dashboard`,
  })
}

/**
 * Send registration rejected email
 * @param {Object} data - { email, ownerName, propertyAddress, registrationId, reviewNotes }
 */
export const sendRegistrationRejectedEmail = async (data) => {
  const subject = 'Registration Review Update'
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #ef4444; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9fafb; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
        .notes { background-color: #fee2e2; padding: 15px; border-left: 4px solid #ef4444; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Registration Review Update</h1>
        </div>
        <div class="content">
          <p>Dear ${data.ownerName},</p>
          <p>We have reviewed your land registration for <strong>${data.propertyAddress}</strong>.</p>
          <p>Unfortunately, your registration could not be approved at this time.</p>
          ${data.reviewNotes ? `<div class="notes"><strong>Reason:</strong><br>${data.reviewNotes}</div>` : ''}
          <p>You can edit and resubmit your registration if needed.</p>
          <p>Registration ID: <strong>${data.registrationId}</strong></p>
          <a href="${window.location.origin}/dashboard" class="button">View Registration</a>
        </div>
        <div class="footer">
          <p>This is an automated message from LandLedger. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `

  return sendEmail({
    to: data.email,
    subject,
    html,
    text: `Dear ${data.ownerName},\n\nWe have reviewed your land registration for ${data.propertyAddress}.\n\nUnfortunately, your registration could not be approved at this time.\n\n${data.reviewNotes ? `Reason: ${data.reviewNotes}\n\n` : ''}You can edit and resubmit your registration if needed.\n\nRegistration ID: ${data.registrationId}\n\nView registration: ${window.location.origin}/dashboard`,
  })
}

/**
 * Send property inquiry email
 * @param {Object} data - { ownerEmail, ownerName, propertyTitle, inquirerName, inquirerEmail, inquirerPhone, message }
 */
export const sendPropertyInquiryEmail = async (data) => {
  const subject = `New Inquiry for ${data.propertyTitle}`
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9fafb; }
        .info-box { background-color: white; padding: 15px; border-radius: 4px; margin: 15px 0; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New Property Inquiry</h1>
        </div>
        <div class="content">
          <p>Dear ${data.ownerName},</p>
          <p>You have received a new inquiry for your property: <strong>${data.propertyTitle}</strong></p>
          <div class="info-box">
            <p><strong>Inquirer Details:</strong></p>
            <p>Name: ${data.inquirerName}</p>
            <p>Email: <a href="mailto:${data.inquirerEmail}">${data.inquirerEmail}</a></p>
            ${data.inquirerPhone ? `<p>Phone: <a href="tel:${data.inquirerPhone}">${data.inquirerPhone}</a></p>` : ''}
            ${data.message ? `<p><strong>Message:</strong><br>${data.message}</p>` : ''}
          </div>
          <a href="${data.propertyLink || window.location.origin + '/properties'}" class="button">View Property</a>
        </div>
        <div class="footer">
          <p>This is an automated message from LandLedger. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `

  return sendEmail({
    to: data.ownerEmail,
    subject,
    html,
    text: `Dear ${data.ownerName},\n\nYou have received a new inquiry for your property: ${data.propertyTitle}\n\nInquirer Details:\nName: ${data.inquirerName}\nEmail: ${data.inquirerEmail}\n${data.inquirerPhone ? `Phone: ${data.inquirerPhone}\n` : ''}${data.message ? `\nMessage:\n${data.message}\n` : ''}\n\nView property: ${data.propertyLink || window.location.origin + '/properties'}`,
  })
}

/**
 * Send property sold/rented email
 * @param {Object} data - { email, ownerName, propertyTitle, listingType }
 */
export const sendPropertySoldRentedEmail = async (data) => {
  const action = data.listingType === 'for_rent' ? 'rented' : 'sold'
  const subject = `Your Property Has Been ${action.charAt(0).toUpperCase() + action.slice(1)}!`
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #10b981; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9fafb; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Property ${action.charAt(0).toUpperCase() + action.slice(1)}</h1>
        </div>
        <div class="content">
          <p>Dear ${data.ownerName},</p>
          <p>Congratulations! Your property <strong>${data.propertyTitle}</strong> has been ${action}.</p>
          <p>You can view the details in your dashboard.</p>
          <a href="${window.location.origin}/dashboard" class="button">View Dashboard</a>
        </div>
        <div class="footer">
          <p>This is an automated message from LandLedger. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `

  return sendEmail({
    to: data.email,
    subject,
    html,
    text: `Dear ${data.ownerName},\n\nCongratulations! Your property ${data.propertyTitle} has been ${action}.\n\nYou can view the details in your dashboard.\n\nView dashboard: ${window.location.origin}/dashboard`,
  })
}

