-- Fix profiles RLS policy to work with Clerk JWT
-- Run this in your Supabase SQL Editor
-- This makes the profiles SELECT policy more permissive to handle Clerk JWT parsing issues

-- ============================================================================
-- STEP 1: Ensure clerk_user_id() function exists
-- ============================================================================

CREATE OR REPLACE FUNCTION public.clerk_user_id() 
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'sub',
    current_setting('request.jwt.claims', true)::json->>'user_id',
    current_setting('request.jwt.claims', true)::json->>'id',
    current_setting('request.jwt.claims', true)::json->>'clerk_user_id'
  );
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- STEP 2: Drop existing policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile or admins view all" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile or admins update any" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- ============================================================================
-- STEP 3: Create more permissive SELECT policy
-- ============================================================================

-- Policy: Allow users to view their own profile
-- More lenient: allows if JWT exists and user_id matches, or if JWT exists and id matches
CREATE POLICY "Users can view own profile or admins view all" ON profiles
  FOR SELECT USING (
    -- If clerk_user_id() works, use it
    (public.clerk_user_id() IS NOT NULL AND (
      public.clerk_user_id() = id
      OR (EXISTS(SELECT 1 FROM profiles WHERE id = public.clerk_user_id() AND is_admin = true))
    ))
    -- OR if JWT exists, try to match using direct JWT claims
    OR (
      current_setting('request.jwt.claims', true) IS NOT NULL
      AND (
        -- Try matching id with various JWT claim formats
        id = current_setting('request.jwt.claims', true)::json->>'sub'
        OR id = current_setting('request.jwt.claims', true)::json->>'user_id'
        OR id = current_setting('request.jwt.claims', true)::json->>'id'
        -- Also check if user is admin (by checking the profile)
        OR EXISTS(
          SELECT 1 FROM profiles p 
          WHERE p.id = current_setting('request.jwt.claims', true)::json->>'sub' 
          AND p.is_admin = true
        )
      )
    )
  );

-- ============================================================================
-- STEP 4: Create UPDATE policy
-- ============================================================================

CREATE POLICY "Users can update own profile or admins update any" ON profiles
  FOR UPDATE USING (
    (public.clerk_user_id() IS NOT NULL AND (
      public.clerk_user_id() = id
      OR EXISTS(SELECT 1 FROM profiles WHERE id = public.clerk_user_id() AND is_admin = true)
    ))
    OR (
      current_setting('request.jwt.claims', true) IS NOT NULL
      AND (
        id = current_setting('request.jwt.claims', true)::json->>'sub'
        OR id = current_setting('request.jwt.claims', true)::json->>'user_id'
        OR id = current_setting('request.jwt.claims', true)::json->>'id'
        OR EXISTS(
          SELECT 1 FROM profiles p 
          WHERE p.id = current_setting('request.jwt.claims', true)::json->>'sub' 
          AND p.is_admin = true
        )
      )
    )
  )
  WITH CHECK (
    (public.clerk_user_id() IS NOT NULL AND (
      public.clerk_user_id() = id
      OR EXISTS(SELECT 1 FROM profiles WHERE id = public.clerk_user_id() AND is_admin = true)
    ))
    OR (
      current_setting('request.jwt.claims', true) IS NOT NULL
      AND (
        id = current_setting('request.jwt.claims', true)::json->>'sub'
        OR id = current_setting('request.jwt.claims', true)::json->>'user_id'
        OR id = current_setting('request.jwt.claims', true)::json->>'id'
        OR EXISTS(
          SELECT 1 FROM profiles p 
          WHERE p.id = current_setting('request.jwt.claims', true)::json->>'sub' 
          AND p.is_admin = true
        )
      )
    )
  );

-- ============================================================================
-- STEP 5: Create INSERT policy
-- ============================================================================

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (
    (public.clerk_user_id() IS NOT NULL AND public.clerk_user_id() = id)
    OR (
      current_setting('request.jwt.claims', true) IS NOT NULL
      AND (
        id = current_setting('request.jwt.claims', true)::json->>'sub'
        OR id = current_setting('request.jwt.claims', true)::json->>'user_id'
        OR id = current_setting('request.jwt.claims', true)::json->>'id'
      )
    )
  );

-- ============================================================================
-- Verification
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

SELECT 'Profiles RLS policies updated successfully!' as message;

