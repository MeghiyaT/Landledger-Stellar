-- Migration: Add Aadhar Card and PAN Card columns to profiles table
-- Run this in your Supabase SQL Editor

-- Add aadhar_card column to store Aadhar card document URL
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS aadhar_card TEXT;

-- Add pan_card column to store PAN card document URL
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS pan_card TEXT;

-- Add comments
COMMENT ON COLUMN profiles.aadhar_card IS 'URL to the Aadhar Card document stored in user profile';
COMMENT ON COLUMN profiles.pan_card IS 'URL to the PAN Card document stored in user profile';

SELECT 'Profiles table updated with Aadhar Card and PAN Card fields!' as message;



