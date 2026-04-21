-- Fix inquiries INSERT policy to be more permissive
-- Run this in your Supabase SQL Editor

-- Drop existing policy
DROP POLICY IF EXISTS "Users can create inquiries" ON inquiries;

-- Create a more permissive INSERT policy
-- Allow anyone to create inquiries (for anonymous users too)
-- This is permissive to handle cases where JWT parsing might not be configured
CREATE POLICY "Users can create inquiries" ON inquiries
  FOR INSERT WITH CHECK (
    -- Allow if user_id is NULL (anonymous inquiry)
    user_id IS NULL
    -- OR if user_id matches the JWT user ID (if JWT parsing works)
    OR (public.clerk_user_id() IS NOT NULL AND user_id = public.clerk_user_id())
    -- OR if JWT exists (authenticated user, even if clerk_user_id() returns NULL)
    -- This handles cases where Supabase JWT parsing isn't configured for Clerk
    OR current_setting('request.jwt.claims', true) IS NOT NULL
    -- OR if user_id is provided and JWT exists (fallback for authenticated users)
    OR (user_id IS NOT NULL AND current_setting('request.jwt.claims', true) IS NOT NULL)
  );

SELECT 'Inquiries INSERT policy updated successfully!' as message;





