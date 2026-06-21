import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('properties').update({ nft_token_id: null }).eq('nft_token_id', 4).select();
  console.log("Updated:", data, "Error:", error);
}
run();
