-- ============================================================================
-- FINAL FIX: Storage Upload Policy for Clerk Authentication
-- Run this in Supabase SQL Editor
-- ============================================================================

-- IMPORTANT: Make sure bucket exists first!
-- Go to Storage > New Bucket > Name: "property-images" > Public: Yes

-- Step 1: Enable RLS (if not already)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND (policyname LIKE '%property%' OR policyname LIKE '%image%')) LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON storage.objects';
    END LOOP;
END $$;

-- Step 3: Create INSERT policy that works with Clerk JWT
-- This checks for ANY JWT token (not just authenticated role)
CREATE POLICY "property-images-insert"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'property-images'
  AND (
    -- Check if JWT exists (works with Clerk)
    current_setting('request.jwt.claims', true) IS NOT NULL
    -- OR check for authenticated role (Supabase Auth)
    OR (SELECT current_setting('request.jwt.claims', true)::json->>'role') = 'authenticated'
    OR auth.role() = 'authenticated'
  )
);

-- Step 4: Create SELECT policy (public read)
CREATE POLICY "property-images-select"
ON storage.objects
FOR SELECT
USING (bucket_id = 'property-images');

-- Step 5: Create UPDATE policy
CREATE POLICY "property-images-update"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'property-images'
  AND (
    current_setting('request.jwt.claims', true) IS NOT NULL
    OR auth.role() = 'authenticated'
  )
)
WITH CHECK (
  bucket_id = 'property-images'
  AND (
    current_setting('request.jwt.claims', true) IS NOT NULL
    OR auth.role() = 'authenticated'
  )
);

-- Step 6: Create DELETE policy
CREATE POLICY "property-images-delete"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'property-images'
  AND (
    current_setting('request.jwt.claims', true) IS NOT NULL
    OR auth.role() = 'authenticated'
  )
);

-- Step 7: Verify
SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies 
WHERE tablename = 'objects' 
  AND policyname LIKE 'property-images%'
ORDER BY policyname;

SELECT '✅ Policies created! Try uploading an image now.' as result;



