-- ============================================================================
-- Storage Troubleshooting Script
-- Run this to diagnose and fix storage upload issues
-- ============================================================================

-- Step 1: Check if bucket exists
SELECT name, public, created_at 
FROM storage.buckets 
WHERE name = 'property-images';

-- If the above returns no rows, create the bucket manually in Dashboard:
-- Storage > New Bucket > Name: "property-images" > Public: Yes

-- Step 2: Check current policies
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
WHERE tablename = 'objects' 
  AND (policyname LIKE '%property%' OR policyname LIKE '%image%')
ORDER BY policyname;

-- Step 3: Drop ALL existing policies for property-images
DROP POLICY IF EXISTS "Users can upload property images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view property images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own property images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own property images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;
DROP POLICY IF EXISTS "property-images-upload" ON storage.objects;
DROP POLICY IF EXISTS "property-images-read" ON storage.objects;

-- Step 4: TEMPORARY FIX - Create very permissive policy for testing
-- This allows ANY authenticated user to upload to property-images bucket
-- WARNING: This is less secure but will work with Clerk authentication
CREATE POLICY "property-images-upload-permissive"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'property-images');

-- Step 5: Allow public read access
CREATE POLICY "property-images-read-public"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'property-images');

-- Step 6: Allow authenticated users to update
CREATE POLICY "property-images-update-permissive"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'property-images')
WITH CHECK (bucket_id = 'property-images');

-- Step 7: Allow authenticated users to delete
CREATE POLICY "property-images-delete-permissive"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'property-images');

-- Step 8: Verify policies were created
SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies 
WHERE tablename = 'objects' 
  AND policyname LIKE '%property-images%'
ORDER BY policyname;

SELECT 'Troubleshooting complete! Policies created. Try uploading an image now.' as message;



