-- EMERGENCY FIX: Completely disable RLS for inquiries table (TEMPORARY)
-- Use this ONLY if the other fixes don't work
-- Run this in your Supabase SQL Editor
-- ⚠️ WARNING: This disables RLS entirely - less secure but will work immediately

-- Step 1: Drop ALL existing policies on inquiries table
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
        RAISE NOTICE 'Dropped policy: %', r.policyname;
    END LOOP;
END $$;

-- Step 2: Disable RLS temporarily (for debugging)
ALTER TABLE inquiries DISABLE ROW LEVEL SECURITY;

-- Step 3: Verify RLS is disabled
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'inquiries';

-- Step 4: Success message
SELECT '⚠️ RLS DISABLED for inquiries table. This is TEMPORARY - re-enable it once JWT is configured!' as warning;
SELECT 'After fixing JWT, run: ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;' as next_step;
SELECT 'Then create a proper policy with: CREATE POLICY "Allow all inquiries" ON inquiries FOR INSERT WITH CHECK (true);' as policy_creation;





