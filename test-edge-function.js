/**
 * Test Edge Function from Browser Console
 * Run this after logging in to test the Edge Function
 */

async function testEdgeFunction() {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

  console.log('Testing Edge Function...')
  console.log('Supabase URL:', SUPABASE_URL)
  console.log('Has API Key:', !!SUPABASE_ANON_KEY)

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        to: 'test@example.com', // Replace with your email
        subject: 'Test Email',
        html: '<p>This is a test email from Edge Function</p>',
        text: 'This is a test email from Edge Function',
      }),
    })

    console.log('Response status:', response.status)
    const result = await response.json()
    console.log('Response:', result)

    if (response.ok && result.success) {
      console.log('✅ Edge Function is working!')
    } else {
      console.error('❌ Edge Function error:', result.error || result)
    }
  } catch (error) {
    console.error('❌ Error calling Edge Function:', error)
  }
}

// Run the test
testEdgeFunction()







