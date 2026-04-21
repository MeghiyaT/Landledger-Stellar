-- Fix RLS for property_offers table (disable if needed)
-- Run this in your Supabase SQL Editor if you get RLS errors

-- Drop all existing policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'property_offers'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON property_offers', r.policyname);
    END LOOP;
END $$;

-- Disable RLS temporarily (for debugging)
ALTER TABLE property_offers DISABLE ROW LEVEL SECURITY;

SELECT '✅ RLS has been DISABLED for property_offers table. Offers should work now!' as result;
