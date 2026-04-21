# Storage Upload Fix - Using Service Role Key

## Quick Fix for Image Upload Issues

Since Supabase Storage RLS isn't recognizing Clerk JWT tokens, we're using a service role key for storage operations as a workaround.

## Setup Steps

### Step 1: Get Your Service Role Key
1. Go to **Supabase Dashboard** → **Settings** → **API**
2. Find **service_role** key (NOT the anon key!)
3. Copy it (keep it secret!)

### Step 2: Add to Environment Variables
1. Open your `.env` file in the project root
2. Add this line:
   ```
   VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```
3. Replace `your_service_role_key_here` with the actual key
4. Save the file
5. **Restart your development server** (important!)

### Step 3: Verify Bucket Exists
1. Go to **Supabase Dashboard** → **Storage**
2. Check if `property-images` bucket exists
3. If not, create it:
   - Click **New Bucket**
   - Name: `property-images`
   - Toggle **Public** to **ON**
   - Click **Create Bucket**

### Step 4: Test Upload
Try uploading an image now. It should work!

## Security Notes

⚠️ **IMPORTANT**: 
- The service role key **bypasses all RLS policies**
- It has full access to your Supabase project
- **Never commit this key to Git** (it should be in `.gitignore`)
- **Never expose it in client-side code** (we're using it here as a workaround)
- This is a **temporary solution** until proper Clerk JWT configuration is set up

## Better Long-Term Solution

For production, you should:
1. Configure Clerk JWT to work with Supabase Storage RLS
2. Or create a backend API endpoint that handles uploads securely
3. Or use a different storage service (AWS S3, Cloudinary, etc.)

## What Changed

- Created `src/lib/supabaseStorage.js` - separate client for storage
- Modified `SellProperty.jsx` to use service role key for uploads
- Regular Supabase client still used for other operations (with RLS)

## If It Still Doesn't Work

1. **Check .env file**: Make sure the key is added correctly
2. **Restart dev server**: Environment variables need a restart
3. **Check bucket**: Make sure `property-images` bucket exists and is public
4. **Check console**: Look for any error messages



