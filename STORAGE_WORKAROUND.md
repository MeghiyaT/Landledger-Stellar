# Storage Upload Workaround

Since Supabase Storage RLS isn't recognizing Clerk JWT tokens, here are workarounds:

## Option 1: Temporarily Disable RLS (Quick Test)

This will confirm if RLS is the issue:

1. Go to **Supabase Dashboard** → **Database** → **Tables**
2. Find `storage.objects` table (in `storage` schema)
3. Click on it → Go to **RLS** tab
4. Toggle **Enable RLS** to **OFF**
5. Try uploading an image
6. **If it works**: RLS is the issue, re-enable it and fix policies
7. **If it still fails**: The bucket or path is wrong

## Option 2: Use Service Role Key (NOT FOR PRODUCTION)

Create a separate Supabase client with service role key for storage operations:

**WARNING**: This bypasses all security. Only use for testing!

1. Get your service role key from Supabase Dashboard → Settings → API
2. Create a new client file for storage operations
3. Use it only for image uploads

## Option 3: Configure Clerk JWT in Supabase

Supabase needs to be configured to accept Clerk JWT tokens:

1. Go to **Supabase Dashboard** → **Settings** → **API**
2. Check **JWT Settings**
3. You may need to configure Clerk as a JWT issuer
4. Or use Supabase's JWT template feature

## Option 4: Use Alternative Storage

If storage continues to fail, consider:
- Using a different storage service (AWS S3, Cloudinary, etc.)
- Storing images as base64 in the database (not recommended for large files)
- Using a CDN service

## Recommended Next Steps

1. **First**: Try Option 1 (disable RLS temporarily) to confirm the issue
2. **Then**: If it works, re-enable RLS and create policies via Dashboard
3. **If Dashboard policies don't work**: Check Clerk JWT configuration in Supabase
4. **Last resort**: Use service role key (development only) or alternative storage



