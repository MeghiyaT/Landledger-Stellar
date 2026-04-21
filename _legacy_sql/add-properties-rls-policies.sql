-- Migration: Add RLS policies for properties table INSERT, UPDATE, DELETE
-- Run this in your Supabase SQL Editor
--
-- This migration adds the missing RLS policies to allow users to:
-- 1. Insert properties (with their user_id)
-- 2. Update their own properties (or admins can update any)
-- 3. Delete their own properties (or admins can delete any)
--
-- Note: SELECT policy already exists and allows public read access

-- ============================================================================
-- STEP 1: Ensure clerk_user_id() function exists (from admin-approval-migration.sql)
-- ============================================================================

-- Create function to get Clerk user ID from JWT (in public schema)
-- This will work even if it already exists (CREATE OR REPLACE)
-- Tries multiple possible claim locations that Clerk might use
CREATE OR REPLACE FUNCTION public.clerk_user_id() 
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'sub',
    current_setting('request.jwt.claims', true)::json->>'user_id',
    current_setting('request.jwt.claims', true)::json->>'id',
    current_setting('request.jwt.claims', true)::json->>'clerk_user_id',
    -- Also check in nested structure
    current_setting('request.jwt.claims', true)::json->'user'->>'id',
    current_setting('request.jwt.claims', true)::json->'claims'->>'sub',
    current_setting('request.jwt.claims', true)::json->'claims'->>'user_id'
  );
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- STEP 2: Ensure is_admin() function exists (from admin-approval-migration.sql)
-- ============================================================================

-- Create function in public schema to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id_param TEXT)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE id = user_id_param),
    false
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================================================
-- STEP 3: Drop existing policies if they exist (for idempotency)
-- ============================================================================

DROP POLICY IF EXISTS "Users can create properties" ON properties;
DROP POLICY IF EXISTS "Users can update own properties or admins update any" ON properties;
DROP POLICY IF EXISTS "Users can delete own properties or admins delete any" ON properties;

-- ============================================================================
-- STEP 4: Add INSERT policy for properties
-- ============================================================================

-- Policy: Authenticated users can insert properties with their user_id
-- More lenient: allows insert if user_id matches OR if JWT is present (authenticated)
CREATE POLICY "Users can create properties" ON properties
  FOR INSERT WITH CHECK (
    -- Either the user_id matches the JWT user ID
    (public.clerk_user_id() IS NOT NULL AND public.clerk_user_id() = user_id)
    -- OR if JWT exists (authenticated) and user_id is provided
    -- (This handles cases where clerk_user_id() might return NULL due to claim format)
    OR (
      current_setting('request.jwt.claims', true) IS NOT NULL 
      AND user_id IS NOT NULL
      AND (
        -- Try to match any of the possible claim formats
        user_id = current_setting('request.jwt.claims', true)::json->>'sub'
        OR user_id = current_setting('request.jwt.claims', true)::json->>'user_id'
        OR user_id = current_setting('request.jwt.claims', true)::json->>'id'
      )
    )
  );

-- ============================================================================
-- STEP 5: Add UPDATE policy for properties
-- ============================================================================

-- Policy: Users can update their own properties OR admins can update any
CREATE POLICY "Users can update own properties or admins update any" ON properties
  FOR UPDATE USING (
    public.clerk_user_id() = user_id 
    OR public.is_admin(public.clerk_user_id())
  )
  WITH CHECK (
    public.clerk_user_id() = user_id 
    OR public.is_admin(public.clerk_user_id())
  );

-- ============================================================================
-- STEP 6: Add DELETE policy for properties
-- ============================================================================

-- Policy: Users can delete their own properties OR admins can delete any
CREATE POLICY "Users can delete own properties or admins delete any" ON properties
  FOR DELETE USING (
    public.clerk_user_id() = user_id 
    OR public.is_admin(public.clerk_user_id())
  );

-- ============================================================================
-- STEP 7: Grant necessary permissions
-- ============================================================================

-- Ensure the functions can be called by authenticated users
GRANT EXECUTE ON FUNCTION public.clerk_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(TEXT) TO authenticated;

-- ============================================================================
-- STEP 8: Create debug function to test JWT claims (optional, for troubleshooting)
-- ============================================================================

-- Function to debug what's in the JWT claims
CREATE OR REPLACE FUNCTION public.debug_jwt_claims()
RETURNS JSONB AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.debug_jwt_claims() TO authenticated;

-- ============================================================================
-- Verification
-- ============================================================================

-- Check that policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'properties'
ORDER BY policyname;

SELECT 'Properties RLS policies added successfully!' as message;
SELECT 'To debug JWT claims, run: SELECT public.debug_jwt_claims();' as debug_tip;

