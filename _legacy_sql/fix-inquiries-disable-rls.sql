-- SIMPLE FIX: Disable RLS for inquiries table
-- This will immediately fix the issue
-- Run this in your Supabase SQL Editor

-- Step 1: Drop ALL policies on inquiries
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'inquiries'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON inquiries', r.policyname);
    END LOOP;
END $$;

-- Step 2: Disable RLS
ALTER TABLE inquiries DISABLE ROW LEVEL SECURITY;

-- Step 3: Verify it worked
SELECT 
    'RLS Status' as check_type,
    tablename,
    CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as status
FROM pg_tables 
WHERE tablename = 'inquiries';

SELECT '✅ RLS has been DISABLED for inquiries table. Inquiries should work now!' as result;





