-- ============================================================================
-- Property Images Storage Bucket Setup - FIXED VERSION
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- IMPORTANT: Make sure the bucket exists first!
-- Go to Storage > New Bucket > Name: "property-images" > Public: Yes

-- Step 1: Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies for property-images bucket
DROP POLICY IF EXISTS "Users can upload property images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view property images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own property images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own property images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;

-- Step 3: Create a more permissive INSERT policy for Clerk authentication
-- This checks if a JWT token exists (from Clerk) rather than checking auth.uid()
CREATE POLICY "Users can upload property images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'property-images' 
  AND (
    -- Allow if JWT exists (Clerk authentication)
    current_setting('request.jwt.claims', true) IS NOT NULL
    -- OR if using Supabase Auth (fallback)
    OR auth.uid() IS NOT NULL
  )
);

-- Step 4: Create policy for public to view images
CREATE POLICY "Public can view property images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'property-images');

-- Step 5: Create policy for users to update images
CREATE POLICY "Users can update their own property images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'property-images' 
  AND (
    current_setting('request.jwt.claims', true) IS NOT NULL
    OR auth.uid() IS NOT NULL
  )
)
WITH CHECK (
  bucket_id = 'property-images' 
  AND (
    current_setting('request.jwt.claims', true) IS NOT NULL
    OR auth.uid() IS NOT NULL
  )
);

-- Step 6: Create policy for users to delete images
CREATE POLICY "Users can delete their own property images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'property-images' 
  AND (
    current_setting('request.jwt.claims', true) IS NOT NULL
    OR auth.uid() IS NOT NULL
  )
);

-- Step 7: Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'objects' 
  AND policyname LIKE '%property%'
ORDER BY policyname;

SELECT 'Storage bucket policies created successfully! Check the results above to verify.' as message;



