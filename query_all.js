import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase.from('properties').select('id, title, user_id, sold_to, nft_token_id, nft_mint_tx_hash, blockchain_property_id')
  console.log(JSON.stringify({data, error}, null, 2))
}
run()
