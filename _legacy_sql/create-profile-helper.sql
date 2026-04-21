-- Helper: Create Profile for Clerk User
-- Run this in Supabase SQL Editor to create a profile for your user

-- Replace 'YOUR_CLERK_USER_ID' with your actual Clerk user ID
-- Get it from: window.Clerk?.user?.id in browser console

-- This will create a profile if it doesn't exist, or update if it does
INSERT INTO profiles (id, is_admin, full_name) 
VALUES ('YOUR_CLERK_USER_ID', false, 'Your Name')
ON CONFLICT (id) DO UPDATE 
SET full_name = COALESCE(profiles.full_name, EXCLUDED.full_name);

-- To make yourself admin, run this after creating the profile:
-- UPDATE profiles SET is_admin = true WHERE id = 'YOUR_CLERK_USER_ID';







