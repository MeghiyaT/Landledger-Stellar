-- Add wallet_address column to profiles table
-- Run this in Supabase SQL Editor

-- Add wallet_address column if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS wallet_address TEXT;

-- Add comment for documentation
COMMENT ON COLUMN profiles.wallet_address IS 'Ethereum wallet address connected via MetaMask';







