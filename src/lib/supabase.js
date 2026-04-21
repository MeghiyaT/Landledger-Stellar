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

export const setClerkTokenGetter = (getter) => {
  clerkTokenGetter = getter
}

// Create Supabase client with Clerk JWT integration.
// The global.fetch wrapper injects the Clerk JWT into every request so that
// Supabase RLS policies can identify the logged-in user.
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  global: {
    fetch: async (url, options = {}) => {
      let token = null
      if (clerkTokenGetter) {
        try {
          token = await clerkTokenGetter({ template: 'supabase' })
        } catch {
          // Supabase JWT template not configured — fall back to the default
          // Clerk session token. RLS policies that check sub() will still work.
          try {
            token = await clerkTokenGetter()
          } catch {
            // No token available (user not signed in)
          }
        }
      }

      const headers = {
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }

      return fetch(url, { ...options, headers })
    },
  },
})
