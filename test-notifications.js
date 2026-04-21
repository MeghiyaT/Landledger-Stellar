/**
 * Test script to verify notifications and email setup
 * Run this in browser console after logging in
 */

// Test 1: Check environment variables
console.log('=== Environment Variables ===')
console.log('VITE_EMAIL_ENABLED:', import.meta.env.VITE_EMAIL_ENABLED)
console.log('VITE_RESEND_API_KEY:', import.meta.env.VITE_RESEND_API_KEY ? 'Set (hidden)' : 'NOT SET')
console.log('VITE_EMAIL_FROM:', import.meta.env.VITE_EMAIL_FROM)

// Test 2: Check if notifications table exists
async function testNotifications() {
  console.log('\n=== Testing Notifications ===')
  
  try {
    await import('./src/lib/supabase.js')
    const { getNotifications } = await import('./src/services/notifications.js')
    await import('@clerk/clerk-react')
    
    // Get user ID from Clerk
    const userId = window.Clerk?.user?.id
    console.log('User ID:', userId)
    
    if (!userId) {
      console.error('❌ Not logged in. Please log in first.')
      return
    }
    
    // Try to get notifications
    const result = await getNotifications(userId, { limit: 5 })
    
    if (result.error) {
      console.error('❌ Error fetching notifications:', result.error)
      console.log('💡 Make sure you ran notifications-migration.sql in Supabase')
    } else {
      console.log('✅ Notifications table exists!')
      console.log('Notifications found:', result.data?.length || 0)
    }
  } catch (error) {
    console.error('❌ Error testing notifications:', error)
  }
}

// Test 3: Test email service
async function testEmail() {
  console.log('\n=== Testing Email Service ===')
  
  try {
    const { sendEmail } = await import('./src/services/email.js')
    
    const result = await sendEmail({
      to: 'test@example.com', // Replace with your email
      subject: 'Test Email',
      html: '<p>This is a test email</p>',
      text: 'This is a test email',
    })
    
    if (result.success) {
      console.log('✅ Email service is working!')
      console.log('Email ID:', result.data?.id)
    } else {
      console.error('❌ Email service error:', result.error)
    }
  } catch (error) {
    console.error('❌ Error testing email:', error)
  }
}

// Run tests
console.log('Starting notification tests...\n')
testNotifications()
testEmail()

console.log('\n=== Instructions ===')
console.log('1. Check the output above for any errors')
console.log('2. If notifications table error: Run notifications-migration.sql in Supabase')
console.log('3. If email error: Check your .env file and Resend API key')
console.log('4. Submit a test registration and check browser console for logs')







