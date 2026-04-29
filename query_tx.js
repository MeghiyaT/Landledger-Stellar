/* eslint-env node */
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function run() {
  const { data, error } = await supabase.from('transactions').select('*').eq('status', 'failed')
  console.log(JSON.stringify({data, error}, null, 2))
}
run()
