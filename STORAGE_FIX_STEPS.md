# Fix Storage Upload Error - Step by Step

## The Problem
You're getting: `new row violates row-level security policy` (403 error)

This means Supabase Storage isn't recognizing your Clerk authentication token.

## Solution Steps

### Step 1: Verify Bucket Exists
1. Go to **Supabase Dashboard** → **Storage**
2. Check if `property-images` bucket exists
3. If NOT, create it:
   - Click **New Bucket**
   - Name: `property-images` (exact, case-sensitive)
   - Toggle **Public** to **ON**
   - Click **Create Bucket**

### Step 2: Run Troubleshooting SQL
1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy and paste the **ENTIRE** contents of `storage-troubleshooting.sql`
3. Click **Run** (or press Ctrl+Enter)
4. Check the results - it should show:
   - Bucket exists
   - Policies were created

### Step 3: Test Upload
1. Go back to your app
2. Try uploading an image again
3. If it still fails, continue to Step 4

### Step 4: Check JWT Token (If Step 3 Failed)
The issue might be that Supabase isn't recognizing Clerk tokens. Check:

1. Open browser **Developer Tools** (F12)
2. Go to **Network** tab
3. Try uploading an image
4. Find the failed request to `storage/v1/object/property-images/...`
5. Click on it → **Headers** tab
6. Check if `Authorization: Bearer ...` header exists
7. If NO Authorization header, the Clerk token isn't being sent

### Step 5: Alternative - Disable RLS Temporarily (TESTING ONLY)
If nothing else works, you can temporarily disable RLS:

```sql
-- WARNING: This makes storage public - USE ONLY FOR TESTING
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
```

**After testing, re-enable RLS:**
```sql
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
```

Then run the policies from `storage-troubleshooting.sql` again.

## What the Troubleshooting Script Does

1. Checks if bucket exists
2. Shows current policies
3. Drops old policies
4. Creates new permissive policies that work with Clerk
5. Verifies policies were created

## Still Not Working?

If you've done all steps and it still fails:

1. **Check Clerk JWT Configuration in Supabase:**
   - Supabase Dashboard → Settings → API
   - Verify JWT settings are configured for Clerk

2. **Check if you're logged in:**
   - Make sure you're authenticated in your app
   - Check browser console for authentication errors

3. **Try a different approach:**
   - Use Supabase Auth instead of Clerk (not recommended if you're already using Clerk)
   - Or use a service role key (NOT recommended for production)

## Expected Result

After running `storage-troubleshooting.sql`, you should see:
- 4 policies created (upload, read, update, delete)
- Image upload should work
- No more 403 errors



