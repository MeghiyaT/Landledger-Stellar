# Create Registration Documents Storage Bucket

## Problem
Getting "Bucket not found" error when viewing Aadhar/PAN cards.

## Solution: Create the Storage Bucket

### Step 1: Go to Supabase Dashboard
1. Open your Supabase Dashboard
2. Navigate to **Storage** in the left sidebar

### Step 2: Create the Bucket
1. Click **"New bucket"** or **"Create bucket"**
2. **Bucket name**: `registration-documents`
3. **Public bucket**: Toggle to **ON** (enabled)
   - This allows public access to documents via URLs
4. Click **"Create bucket"** or **"Save"**

### Step 3: Verify Bucket Settings
- Bucket name: `registration-documents`
- Public: **ON** (enabled)
- File size limit: Set as needed (default is usually fine)

## Alternative: Check if Bucket Exists

If the bucket already exists but you're still getting errors:
1. Go to **Storage** → Check if `registration-documents` bucket exists
2. If it exists, click on it → **Settings**
3. Make sure **"Public bucket"** is **ON**
4. Check the bucket policies (should allow public read access)

## After Creating the Bucket

1. Refresh your browser
2. Try uploading/viewing documents again
3. The 404 error should be resolved

## Note

If you prefer to keep the bucket private, you'll need to:
- Use signed URLs instead of public URLs
- Update the code to generate signed URLs when viewing documents



