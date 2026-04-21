-- SIMPLE FIX: Very permissive inquiries INSERT policy
-- Use this if the other fix doesn't work
-- Run this in your Supabase SQL Editor

-- Drop existing policy
DROP POLICY IF EXISTS "Users can create inquiries" ON inquiries;

-- Create a very permissive INSERT policy
-- This allows anyone to create inquiries (for testing/debugging)
-- You can tighten this later once JWT parsing is configured
CREATE POLICY "Users can create inquiries" ON inquiries
  FOR INSERT WITH CHECK (true);

-- Note: This policy allows anyone to create inquiries.
-- Once your JWT parsing is working, you should update this to be more secure.

SELECT 'Inquiries INSERT policy updated (very permissive mode)!' as message;
SELECT 'WARNING: This policy allows anyone to create inquiries. Update it once JWT parsing is configured.' as warning;





