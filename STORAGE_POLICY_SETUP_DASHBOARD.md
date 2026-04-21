# Storage Policy Setup via Supabase Dashboard

Since you don't have SQL permissions for storage.objects, we need to create policies through the Dashboard.

## Method 1: Create Policies via Dashboard (Recommended)

### Step 1: Verify Bucket Exists
1. Go to **Supabase Dashboard** → **Storage**
2. Check if `property-images` bucket exists
3. If NOT, create it:
   - Click **New Bucket**
   - Name: `property-images` (exact, case-sensitive)
   - Toggle **Public** to **ON**
   - Click **Create Bucket**

### Step 2: Create Policies via Dashboard
1. Go to **Storage** → Click on `property-images` bucket
2. Click on **Policies** tab
3. Click **New Policy**

#### Policy 1: Allow Upload (INSERT)
- **Policy Name**: `Allow authenticated uploads`
- **Allowed Operation**: `INSERT`
- **Target Roles**: `authenticated`
- **Policy Definition** (USING expression): Leave empty or use: `bucket_id = 'property-images'`
- **Policy Definition** (WITH CHECK expression): `bucket_id = 'property-images'`
- Click **Save**

#### Policy 2: Allow Public Read (SELECT)
- **Policy Name**: `Allow public read`
- **Allowed Operation**: `SELECT`
- **Target Roles**: `public`
- **Policy Definition** (USING expression): `bucket_id = 'property-images'`
- Click **Save**

#### Policy 3: Allow Update (UPDATE)
- **Policy Name**: `Allow authenticated update`
- **Allowed Operation**: `UPDATE`
- **Target Roles**: `authenticated`
- **Policy Definition** (USING expression): `bucket_id = 'property-images'`
- **Policy Definition** (WITH CHECK expression): `bucket_id = 'property-images'`
- Click **Save**

#### Policy 4: Allow Delete (DELETE)
- **Policy Name**: `Allow authenticated delete`
- **Allowed Operation**: `DELETE`
- **Target Roles**: `authenticated`
- **Policy Definition** (USING expression): `bucket_id = 'property-images'`
- Click **Save**

## Method 2: Use Service Role Key (NOT RECOMMENDED FOR PRODUCTION)

If Dashboard method doesn't work, you can temporarily use the service role key, but this bypasses security.

## Method 3: Contact Supabase Support

If you're on a free tier and can't create policies, you may need to:
1. Upgrade your plan, OR
2. Contact Supabase support to enable storage policy creation

## Quick Test: Disable RLS Temporarily

If you have access, you can test by temporarily disabling RLS:

1. Go to **Database** → **Tables**
2. Find `storage.objects` table
3. Go to **RLS** tab
4. Toggle **Enable RLS** to **OFF** (temporarily)
5. Try uploading
6. **IMPORTANT**: Re-enable RLS after testing!

## Alternative: Use Supabase Auth Instead of Clerk

If Clerk authentication continues to cause issues with storage, you might need to:
1. Use Supabase Auth for storage operations
2. Or configure Clerk JWT to work with Supabase Storage



