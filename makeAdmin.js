import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing credentials');
  process.exit(1);
}

const supabase = createClient(url, key);

async function makeAdmin() {
  const userId = 'user_36lJ6ngLlKOF7mgXcG5pnabyMVL';
  
  // First check if profile exists
  let { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
  
  if (!profile) {
    console.log('Profile does not exist. Creating profile...');
    const { data: newProfile, error } = await supabase.from('profiles').insert([{
      id: userId,
      is_admin: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }]).select().single();
    
    if (error) {
      console.error('Error creating profile:', error);
    } else {
      console.log('Created admin profile:', newProfile);
    }
  } else {
    console.log('Profile exists. Updating to admin...');
    const { data, error } = await supabase.from('profiles').update({ is_admin: true }).eq('id', userId).select().single();
    if (error) {
      console.error('Error updating profile:', error);
    } else {
      console.log('Updated profile:', data);
    }
  }
}

makeAdmin();
