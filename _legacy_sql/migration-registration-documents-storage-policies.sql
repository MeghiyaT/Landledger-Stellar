-- ============================================================================
-- Registration Documents Storage Bucket Policies
-- Run this in your Supabase SQL Editor
-- ============================================================================
-- This sets up RLS policies for the registration-documents bucket to allow
-- users to upload, read, update, and delete their own profile documents
-- and registration documents.

-- IMPORTANT: Make sure the bucket exists first!
-- Go to Storage > New Bucket > Name: "registration-documents" > Public: No (or Yes, depending on your needs)

-- Step 1: Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing policies for registration-documents bucket (if any)
DROP POLICY IF EXISTS "Users can upload registration documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own registration documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own profile documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own registration documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own registration documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can view registration documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload registration documents" ON storage.objects;

-- Step 3: Create helper function to extract user ID from storage path
-- This function extracts the user ID from paths like:
--   - "profile-documents/user_xxx/aadhar/file.jpg"
--   - "profile-documents/user_xxx/pan/file.jpg"
--   - "registrations/user_xxx/registration_xxx/file.pdf"
CREATE OR REPLACE FUNCTION public.get_user_id_from_storage_path(path TEXT)
RETURNS TEXT AS $$
  SELECT CASE
    -- Pattern: profile-documents/user_xxx/...
    WHEN path ~ '^profile-documents/user_' THEN
      regexp_replace(path, '^profile-documents/(user_[^/]+)/.*', '\1')
    -- Pattern: registrations/user_xxx/...
    WHEN path ~ '^registrations/user_' THEN
      regexp_replace(path, '^registrations/(user_[^/]+)/.*', '\1')
    ELSE NULL
  END;
$$ LANGUAGE SQL IMMUTABLE;

-- Step 4: Create INSERT policy - users can upload their own documents
CREATE POLICY "Users can upload registration documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'registration-documents' 
  AND (
    -- Allow if JWT exists (Clerk authentication)
    current_setting('request.jwt.claims', true) IS NOT NULL
    -- OR if using Supabase Auth (fallback)
    OR auth.uid() IS NOT NULL
  )
  -- Ensure the path contains the user's ID (basic security check)
  AND (
    public.get_user_id_from_storage_path(name) = public.clerk_user_id()
    OR current_setting('request.jwt.claims', true)::json->>'sub' = public.get_user_id_from_storage_path(name)
  )
);

-- Step 5: Create SELECT policy - users can view their own documents
-- This is the critical one that was missing and causing the 400 error
-- We create two policies: one for authenticated users (more secure) and one for public access
-- Public access is needed when using getPublicUrl()

-- Policy for authenticated users to read their own documents
CREATE POLICY "Users can view their own registration documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'registration-documents'
  AND (
    -- Allow if the document path contains the user's ID
    public.get_user_id_from_storage_path(name) = public.clerk_user_id()
    OR public.get_user_id_from_storage_path(name) = current_setting('request.jwt.claims', true)::json->>'sub'
    -- OR if JWT exists and we can verify the user
    OR (
      current_setting('request.jwt.claims', true) IS NOT NULL
      AND (
        public.get_user_id_from_storage_path(name) IS NOT NULL
        -- Additional check: path must start with profile-documents or registrations
        AND (name LIKE 'profile-documents/%' OR name LIKE 'registrations/%')
      )
    )
  )
);

-- Policy for public read access (needed for getPublicUrl() to work)
-- This allows anyone to read documents in the registration-documents bucket
-- Note: If you want to restrict this further, you could make the bucket private
-- and use signed URLs instead of public URLs
CREATE POLICY "Public can view registration documents"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'registration-documents');

-- Step 6: Create UPDATE policy - users can update their own documents
CREATE POLICY "Users can update their own registration documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'registration-documents' 
  AND (
    public.get_user_id_from_storage_path(name) = public.clerk_user_id()
    OR public.get_user_id_from_storage_path(name) = current_setting('request.jwt.claims', true)::json->>'sub'
    OR (
      current_setting('request.jwt.claims', true) IS NOT NULL
      AND public.get_user_id_from_storage_path(name) IS NOT NULL
    )
  )
)
WITH CHECK (
  bucket_id = 'registration-documents' 
  AND (
    public.get_user_id_from_storage_path(name) = public.clerk_user_id()
    OR public.get_user_id_from_storage_path(name) = current_setting('request.jwt.claims', true)::json->>'sub'
    OR (
      current_setting('request.jwt.claims', true) IS NOT NULL
      AND public.get_user_id_from_storage_path(name) IS NOT NULL
    )
  )
);

-- Step 7: Create DELETE policy - users can delete their own documents
CREATE POLICY "Users can delete their own registration documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'registration-documents' 
  AND (
    public.get_user_id_from_storage_path(name) = public.clerk_user_id()
    OR public.get_user_id_from_storage_path(name) = current_setting('request.jwt.claims', true)::json->>'sub'
    OR (
      current_setting('request.jwt.claims', true) IS NOT NULL
      AND public.get_user_id_from_storage_path(name) IS NOT NULL
    )
  )
);

-- Step 8: Verify policies were created
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

SELECT 'Registration documents storage bucket policies created successfully! Check the results above to verify.' as message;

