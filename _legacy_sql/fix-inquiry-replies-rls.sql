-- Fix RLS for inquiry_replies table (disable if needed)
-- Run this in your Supabase SQL Editor if you get RLS errors

-- Drop all existing policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'inquiry_replies'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON inquiry_replies', r.policyname);
    END LOOP;
END $$;

-- Disable RLS temporarily (for debugging)
ALTER TABLE inquiry_replies DISABLE ROW LEVEL SECURITY;

SELECT '✅ RLS has been DISABLED for inquiry_replies table. Replies should work now!' as result;





