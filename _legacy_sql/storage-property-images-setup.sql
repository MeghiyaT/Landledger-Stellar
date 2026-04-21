-- ============================================================================
-- Property Images Storage Bucket Setup
-- Run this in your Supabase SQL Editor
-- ============================================================================

-- Step 1: Create the storage bucket (if it doesn't exist)
-- Note: You may need to create this manually in the Supabase Dashboard
-- Go to Storage > New Bucket > Name: "property-images" > Public: Yes

-- Step 2: Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload property images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view property images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own property images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own property images" ON storage.objects;

-- Step 3: Create policy for authenticated users to upload images
-- This works with both Supabase Auth and Clerk authentication
-- The 'authenticated' role is granted to any user with a valid JWT token
CREATE POLICY "Users can upload property images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'property-images');

-- Step 4: Create policy for public to view images
CREATE POLICY "Public can view property images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'property-images');

-- Step 5: Create policy for users to update their own images
-- Allows authenticated users to update images in the property-images bucket
CREATE POLICY "Users can update their own property images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'property-images')
WITH CHECK (bucket_id = 'property-images');

-- Step 6: Create policy for users to delete their own images
-- Note: This policy allows any authenticated user to delete images in the property-images bucket
-- For stricter security, you can restrict by folder structure matching user ID
-- Since we're using Clerk, we'll allow authenticated users to delete from property-images bucket
CREATE POLICY "Users can delete their own property images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'property-images');

SELECT 'Storage bucket policies created successfully!' as message;
