import { createClient } from '@supabase/supabase-js'

// ─── SECURITY WARNING ────────────────────────────────────────────────────────
// The service role key bypasses ALL Row Level Security policies.
// In production this should NEVER be exposed client-side.
// Move these operations to a server/edge function before going to production.
// For local development only, keep VITE_SUPABASE_SERVICE_ROLE_KEY in .env and
// ensure .env is in .gitignore.
// ─────────────────────────────────────────────────────────────────────────────

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''

let supabaseStorage = null

if (supabaseUrl && supabaseServiceRoleKey) {
  try {
    supabaseStorage = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  } catch (err) {
    console.error('❌ Failed to create supabaseStorage client:', err)
  }
} else {
  if (!supabaseServiceRoleKey) {
    console.warn(
      '⚠️ VITE_SUPABASE_SERVICE_ROLE_KEY is missing. ' +
      'Storage and profile operations that bypass RLS will not work.'
    )
  }
}

export { supabaseStorage }

// Regular supabase client (for other operations)
export { supabase } from './supabase'
