# Storage Setup Instructions

## Important: You need to run the SQL script to fix image upload errors!

The error "new row violates row-level security policy" occurs because the storage bucket policies haven't been set up correctly for Clerk authentication.

## Steps to Fix:

1. **Open Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your project
   - Navigate to **SQL Editor**

2. **Run the Storage Policy SQL**
   - Open the file `storage-property-images-setup.sql` in this project
   - Copy ALL the SQL code
   - Paste it into the Supabase SQL Editor
   - Click **Run** (or press Ctrl+Enter)

3. **Verify the Bucket Exists**
   - Go to **Storage** in the Supabase Dashboard
   - Check if a bucket named `property-images` exists
   - If it doesn't exist:
     - Click **New Bucket**
     - Name: `property-images`
     - Make it **Public** (toggle ON)
     - Click **Create Bucket**

4. **Test Image Upload**
   - After running the SQL, try uploading an image again
   - The error should be resolved

## What the SQL Does:

- Drops old restrictive policies
- Creates new policies that work with Clerk authentication
- Allows authenticated users to upload, view, update, and delete images
- Makes images publicly viewable

## If You Still Get Errors:

1. Make sure the bucket is named exactly `property-images` (case-sensitive)
2. Make sure the bucket is set to **Public**
3. Check that you're logged in (authenticated)
4. Try refreshing the page after running the SQL



