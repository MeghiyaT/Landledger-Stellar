-- COMPLETE FIX: Drop ALL existing INSERT policies and create a permissive one
-- Run this in your Supabase SQL Editor
-- This will fix the RLS policy issue for inquiries

-- Step 1: Drop ALL existing INSERT policies on inquiries table
-- (There might be multiple policies with different names)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'inquiries' 
        AND cmd = 'INSERT'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON inquiries', r.policyname);
        RAISE NOTICE 'Dropped policy: %', r.policyname;
    END LOOP;
END $$;

-- Step 2: Verify all INSERT policies are dropped
-- (This should return no rows if successful)
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE tablename = 'inquiries' 
AND cmd = 'INSERT';

-- Step 3: Create a very permissive INSERT policy
-- This allows ANYONE to create inquiries (for debugging)
CREATE POLICY "Allow all inquiries" ON inquiries
  FOR INSERT 
  WITH CHECK (true);

-- Step 4: Verify the new policy was created
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'inquiries' 
AND cmd = 'INSERT';

-- Step 5: Success message
SELECT 'Inquiries RLS policy fixed! All INSERT policies dropped and new permissive policy created.' as message;
SELECT 'WARNING: This policy allows anyone to create inquiries. Tighten it later for production.' as warning;





