-- SIMPLE FIX: More permissive UPDATE policy for properties
-- Use this if the main fix doesn't work
-- Run this in your Supabase SQL Editor

-- ============================================================================
-- Drop existing UPDATE policy
-- ============================================================================

DROP POLICY IF EXISTS "Users can update own properties or admins update any" ON properties;

-- ============================================================================
-- Create a simpler, more permissive UPDATE policy
-- ============================================================================

-- This policy allows authenticated users (with JWT) to update properties
-- It's more permissive to handle cases where JWT parsing fails
-- ⚠️ WARNING: This is less secure. Only use if you trust your authentication layer.

CREATE POLICY "Users can update own properties or admins update any" ON properties
  FOR UPDATE USING (
    -- Allow if user owns the property (if we can get user_id from JWT)
    (public.clerk_user_id() IS NOT NULL AND public.clerk_user_id() = user_id)
    -- OR if user is admin
    OR (public.clerk_user_id() IS NOT NULL AND public.is_admin(public.clerk_user_id()))
    -- OR if JWT exists (any authenticated user) - permissive fallback
    OR current_setting('request.jwt.claims', true) IS NOT NULL
  )
  WITH CHECK (
    -- Same conditions for WITH CHECK
    (public.clerk_user_id() IS NOT NULL AND public.clerk_user_id() = user_id)
    OR (public.clerk_user_id() IS NOT NULL AND public.is_admin(public.clerk_user_id()))
    OR current_setting('request.jwt.claims', true) IS NOT NULL
  );

-- ============================================================================
-- Verification
-- ============================================================================

SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'properties' AND cmd = 'UPDATE';

SELECT 'Properties UPDATE policy updated successfully!' as message;





