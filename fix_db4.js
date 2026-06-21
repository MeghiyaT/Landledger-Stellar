import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('properties').update({ nft_token_id: null }).eq('id', 'c5e7d6c9-428a-4d69-ac1c-519d76ba7dfa').select();
  console.log("Updated:", data?.length, "Error:", error);
}
run();
