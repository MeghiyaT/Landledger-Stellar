-- ============================================================================
-- Registration Documents Storage Bucket Policies - SIMPLE VERSION
-- Run this in your Supabase SQL Editor
-- ============================================================================
-- This sets up RLS policies for the registration-documents bucket.
-- Choose ONE approach:
--   1. Make bucket public + use public SELECT policy (simpler)
--   2. Keep bucket private + use signed URLs (more secure, requires code changes)

-- IMPORTANT: First, ensure the bucket exists!
-- Go to Storage > registration-documents bucket > Settings
-- For public access: Set "Public bucket" to ON
-- For private access: Keep "Public bucket" to OFF (then use signed URLs in code)

-- Step 1: Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing policies for registration-documents bucket
DROP POLICY IF EXISTS "Public can view registration documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload registration documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update registration documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete registration documents" ON storage.objects;

-- Step 3: Allow public to view documents (required for getPublicUrl() to work)
-- This is the key policy that fixes the 400 error
-- If your bucket is set to PUBLIC, this allows anyone to read documents
-- If your bucket is PRIVATE, you need to use signed URLs instead (see alternative below)
CREATE POLICY "Public can view registration documents"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'registration-documents');

-- Step 4: Allow authenticated users to upload documents
CREATE POLICY "Users can upload registration documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'registration-documents' 
  AND (
    current_setting('request.jwt.claims', true) IS NOT NULL
    OR auth.uid() IS NOT NULL
  )
);

-- Step 5: Allow authenticated users to update documents
CREATE POLICY "Users can update registration documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'registration-documents' 
  AND (
    current_setting('request.jwt.claims', true) IS NOT NULL
    OR auth.uid() IS NOT NULL
  )
)
WITH CHECK (
  bucket_id = 'registration-documents' 
  AND (
    current_setting('request.jwt.claims', true) IS NOT NULL
    OR auth.uid() IS NOT NULL
  )
);

-- Step 6: Allow authenticated users to delete documents
CREATE POLICY "Users can delete registration documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'registration-documents' 
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
  AND policyname LIKE '%registration%'
ORDER BY policyname;

SELECT 'Registration documents storage bucket policies created successfully!' as message;
SELECT 'IMPORTANT: Make sure the registration-documents bucket is set to PUBLIC in Storage settings if using getPublicUrl()' as note;



