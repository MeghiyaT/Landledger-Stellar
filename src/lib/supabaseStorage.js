import { supabase } from './supabase'

// Backwards-compatible alias kept while older modules finish migrating away
// from the `supabaseStorage` name. This now uses the regular authenticated
// client so no service-role credentials are ever bundled into the browser.
const supabaseStorage = supabase

export { supabase, supabaseStorage }
