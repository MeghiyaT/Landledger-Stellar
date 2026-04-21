-- Fix Notifications RLS Policy
-- The issue: RLS policy blocks notification creation when one user creates a notification for another user
-- Solution: Allow authenticated users to insert notifications for any user_id
-- Run this in your Supabase SQL Editor

-- ============================================================================
-- STEP 1: Drop existing INSERT policy
-- ============================================================================

DROP POLICY IF EXISTS "Users can insert own notifications or admins insert any" ON notifications;

-- ============================================================================
-- STEP 2: Create a more permissive INSERT policy
-- ============================================================================

-- Policy: Allow authenticated users to insert notifications
-- This is needed because the system creates notifications for other users
-- (e.g., when a buyer makes an offer, a notification is created for the seller)
CREATE POLICY "Authenticated users can insert notifications" ON notifications
  FOR INSERT WITH CHECK (
    -- Allow if user is authenticated (has JWT)
    current_setting('request.jwt.claims', true) IS NOT NULL
    -- AND user_id is provided (required field)
    AND user_id IS NOT NULL
  );

-- ============================================================================
-- STEP 3: Verify the fix
-- ============================================================================

-- Check that the policy was created
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
WHERE tablename = 'notifications' 
  AND policyname = 'Authenticated users can insert notifications';

SELECT 'Notifications RLS policy fixed successfully!' as message;

