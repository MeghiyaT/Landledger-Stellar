import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '❌ Supabase credentials not configured. ' +
    'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.'
  )
}

let clerkTokenGetter = null
let isTemplateMissing = false
let didLogFallbackTokenWarning = false

export const setClerkTokenGetter = (getter) => {
  clerkTokenGetter = getter
  isTemplateMissing = false // reset on new getter
  didLogFallbackTokenWarning = false
}

// Create Supabase client with Clerk JWT integration.
// The global.fetch wrapper injects the Clerk JWT into every request so that
// Supabase RLS policies can identify the logged-in user.
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  global: {
    fetch: async (url, options = {}) => {
      let token = null
      if (clerkTokenGetter) {
        if (!isTemplateMissing) {
          try {
            token = await clerkTokenGetter({ template: 'supabase' })
          } catch (err) {
            isTemplateMissing = true
            console.warn('⚠️ Clerk Supabase template not found. Falling back to the default Clerk session token.')
          }
        }

        if (!token) {
          try {
            token = await clerkTokenGetter()
            if (token && !didLogFallbackTokenWarning) {
              didLogFallbackTokenWarning = true
              console.warn('ℹ️ Using the default Clerk session token for Supabase requests until the dedicated template is configured.')
            }
          } catch (fallbackErr) {
            console.warn('⚠️ Failed to obtain a Clerk session token for Supabase:', fallbackErr?.message || fallbackErr)
          }
        }
      }

      // Clone original headers (handles both plain object and Headers instance)
      const headers = new Headers(options.headers || {})
      if (token && typeof token === 'string') {
        headers.set('Authorization', `Bearer ${token}`)
      }

      // If url is a Request object, we must handle it differently
      if (url instanceof Request) {
        // We can't just pass a new headers object if we want to preserve other things,
        // but fetch(Request) is supported. 
        // We might need to clone it or create a new one.
        return fetch(new Request(url, { ...options, headers }))
      }

      if (typeof url !== 'string' || !url) {
        console.error('❌ Supabase fetch called with invalid URL:', url)
        return new Response(JSON.stringify({ error: 'Invalid URL' }), { status: 400 })
      }

      return fetch(url, { ...options, headers })
    },
  },
})
