-- ============================================================================
-- SIMPLE Storage Policy - Try this if you have permissions
-- Run in Supabase SQL Editor
-- ============================================================================

-- This is a simpler version that might work with your permissions
-- If this fails, use the Dashboard method in STORAGE_POLICY_SETUP_DASHBOARD.md

-- Check if we can access storage schema
SELECT current_user, current_database();

-- Try to create policies (may fail if no permissions)
BEGIN;

-- INSERT policy
CREATE POLICY IF NOT EXISTS "property-images-insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'property-images');

-- SELECT policy  
CREATE POLICY IF NOT EXISTS "property-images-select"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'property-images');

-- UPDATE policy
CREATE POLICY IF NOT EXISTS "property-images-update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'property-images')
WITH CHECK (bucket_id = 'property-images');

-- DELETE policy
CREATE POLICY IF NOT EXISTS "property-images-delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'property-images');

COMMIT;

-- If the above fails, you MUST use the Dashboard method
-- See STORAGE_POLICY_SETUP_DASHBOARD.md for instructions



