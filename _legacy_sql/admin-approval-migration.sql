-- Admin Approval System Migration
-- Run this in your Supabase SQL Editor
--
-- NOTE: This migration creates functions in the 'public' schema (not 'auth' schema)
-- because Supabase doesn't allow regular users to create functions in 'auth' schema.
-- If you have existing policies using 'auth.clerk_user_id()', they will be updated
-- to use 'public.clerk_user_id()' instead.

-- ============================================================================
-- STEP 1: Add is_admin field to profiles table
-- ============================================================================

-- Add is_admin column to profiles (defaults to false)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create index for faster admin lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = true;

-- ============================================================================
-- STEP 2: Update profiles table to support Clerk user IDs (TEXT)
-- ============================================================================

-- If profiles.id is still UUID, we need to change it to TEXT for Clerk
-- First, check if it's already TEXT by trying to alter it
-- This will fail gracefully if already TEXT

DO $$
BEGIN
  -- Check if id column is UUID type
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'profiles' 
      AND column_name = 'id' 
      AND data_type = 'uuid'
  ) THEN
    -- Drop foreign key constraint if it exists
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
    
    -- Change id to TEXT
    ALTER TABLE profiles ALTER COLUMN id TYPE TEXT;
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Update registrations table to support Clerk user IDs (TEXT)
-- ============================================================================

-- Check if user_id is UUID and change to TEXT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'registrations' 
      AND column_name = 'user_id' 
      AND data_type = 'uuid'
  ) THEN
    -- Drop foreign key constraint if it exists
    ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_user_id_fkey;
    
    -- Change user_id to TEXT
    ALTER TABLE registrations ALTER COLUMN user_id TYPE TEXT;
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Add admin review fields to registrations table
-- ============================================================================

-- Add fields to track who reviewed and when
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS reviewed_by TEXT,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- ============================================================================
-- STEP 5: Create function to check if user is admin
-- ============================================================================

-- Create function in public schema (not auth schema - requires special permissions)
CREATE OR REPLACE FUNCTION public.is_admin(user_id_param TEXT)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE id = user_id_param),
    false
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================================================
-- STEP 6: Update RLS policies for registrations to allow admin access
-- ============================================================================

-- Drop existing policies (including any that might reference auth.clerk_user_id)
DROP POLICY IF EXISTS "Users can view own registrations" ON registrations;
DROP POLICY IF EXISTS "Users can view own registrations or admins view all" ON registrations;
DROP POLICY IF EXISTS "Users can create own registrations" ON registrations;
DROP POLICY IF EXISTS "Users can update own registrations" ON registrations;
DROP POLICY IF EXISTS "Users can update own registrations or admins update any" ON registrations;

-- Drop existing clerk_user_id function if it exists in auth schema (might fail, that's okay)
-- We'll create it in public schema instead
DO $$
BEGIN
  DROP FUNCTION IF EXISTS auth.clerk_user_id() CASCADE;
EXCEPTION
  WHEN insufficient_privilege THEN
    -- If we can't drop it, that's fine - we'll just create our own in public
    RAISE NOTICE 'Could not drop auth.clerk_user_id() - will create public.clerk_user_id() instead';
  WHEN OTHERS THEN
    -- Any other error, just continue
    RAISE NOTICE 'Error dropping auth.clerk_user_id(): %', SQLERRM;
END $$;

-- Create function to get Clerk user ID from JWT (in public schema)
-- This will work even if auth.clerk_user_id() exists
CREATE OR REPLACE FUNCTION public.clerk_user_id() 
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'sub',
    current_setting('request.jwt.claims', true)::json->>'user_id'
  );
$$ LANGUAGE SQL STABLE;

-- Policy: Users can view their own registrations OR admins can view all
CREATE POLICY "Users can view own registrations or admins view all" ON registrations
  FOR SELECT USING (
    public.clerk_user_id() = user_id 
    OR public.is_admin(public.clerk_user_id())
  );

-- Policy: Users can create their own registrations
CREATE POLICY "Users can create own registrations" ON registrations
  FOR INSERT WITH CHECK (public.clerk_user_id() = user_id);

-- Policy: Users can update their own registrations OR admins can update any
CREATE POLICY "Users can update own registrations or admins update any" ON registrations
  FOR UPDATE USING (
    public.clerk_user_id() = user_id 
    OR public.is_admin(public.clerk_user_id())
  )
  WITH CHECK (
    public.clerk_user_id() = user_id 
    OR public.is_admin(public.clerk_user_id())
  );

-- ============================================================================
-- STEP 7: Update profiles RLS policies to allow admin access
-- ============================================================================

-- Drop existing policies (including any that might reference auth.clerk_user_id)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile or admins view all" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile or admins update any" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Policy: Users can view their own profile OR admins can view all
CREATE POLICY "Users can view own profile or admins view all" ON profiles
  FOR SELECT USING (
    public.clerk_user_id() = id 
    OR public.is_admin(public.clerk_user_id())
  );

-- Policy: Users can update their own profile OR admins can update any
CREATE POLICY "Users can update own profile or admins update any" ON profiles
  FOR UPDATE USING (
    public.clerk_user_id() = id 
    OR public.is_admin(public.clerk_user_id())
  )
  WITH CHECK (
    public.clerk_user_id() = id 
    OR public.is_admin(public.clerk_user_id())
  );

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (public.clerk_user_id() = id);

-- ============================================================================
-- STEP 8: Create a function to automatically create profile for Clerk users
-- ============================================================================

-- Note: This won't auto-trigger for Clerk users since Clerk doesn't use Supabase auth
-- You'll need to create profiles manually or via your app when users sign up
-- But we'll keep this for reference

-- ============================================================================
-- STEP 9: Grant necessary permissions
-- ============================================================================

-- Ensure the function can be called by authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clerk_user_id() TO authenticated;

-- ============================================================================
-- STEP 10: Example - Make a user admin (replace 'user_id_here' with actual Clerk user ID)
-- ============================================================================

-- To make a user admin, run:
-- UPDATE profiles SET is_admin = true WHERE id = 'your_clerk_user_id_here';
--
-- If the user doesn't have a profile yet, create one:
-- INSERT INTO profiles (id, is_admin) VALUES ('your_clerk_user_id_here', true)
-- ON CONFLICT (id) DO UPDATE SET is_admin = true;

SELECT 'Admin approval system migration completed successfully!' as message;

