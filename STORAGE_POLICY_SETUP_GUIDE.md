# Storage Policy Setup Guide for Registration Documents

## Problem
The 400 error when loading profile documents occurs because the `registration-documents` storage bucket doesn't have the proper read (SELECT) policies configured.

## ⚡ Quick Fix (Recommended - 2 minutes)

**The easiest solution is to make the bucket public in the Supabase Dashboard:**

1. Go to your **Supabase Dashboard**
2. Navigate to **Storage** → Click on **`registration-documents`** bucket
3. Click on the **Settings** tab (at the top)
4. Find **"Public bucket"** toggle
5. Toggle it to **ON** (enabled)
6. Click **Save**

✅ **This will automatically allow public read access, which fixes the 400 error immediately.**

The documents will be accessible via public URLs (which is what `getPublicUrl()` uses). This is the simplest solution since you can't modify storage policies via SQL without owner permissions.

---

## Why This Works

When you set a bucket to "Public", Supabase automatically allows public read (SELECT) access to all files in that bucket. This is exactly what's needed for `getPublicUrl()` to work and resolve the 400 error.

---

## Alternative: Configure Policies via Supabase Dashboard (If Needed)

If you prefer to keep the bucket private, you need to configure policies through the Supabase Dashboard.

### Step 1: Access Storage Policies
1. Go to your Supabase Dashboard
2. Navigate to **Storage** in the left sidebar
3. Click on the **`registration-documents`** bucket
4. Click on the **Policies** tab (or **RLS Policies**)

### Step 2: Configure Bucket Settings
1. While in the bucket settings, ensure **"Public bucket"** is set to **ON**
   - This allows public read access (needed for `getPublicUrl()` to work)
   - Go to **Settings** tab → Toggle **"Public bucket"** to ON

### Step 3: Add Storage Policies

If you see a "New Policy" button or policy editor, create the following policies:

#### Policy 1: Public Read Access (SELECT)
- **Policy Name**: `Public can view registration documents`
- **Allowed Operation**: `SELECT`
- **Target Roles**: `public` or `anon`
- **Policy Definition** (USING expression):
```sql
bucket_id = 'registration-documents'
```

#### Policy 2: Authenticated Upload (INSERT)
- **Policy Name**: `Authenticated users can upload documents`
- **Allowed Operation**: `INSERT`
- **Target Roles**: `authenticated`
- **Policy Definition** (WITH CHECK expression):
```sql
bucket_id = 'registration-documents'
```

#### Policy 3: Authenticated Update (UPDATE)
- **Policy Name**: `Authenticated users can update documents`
- **Allowed Operation**: `UPDATE`
- **Target Roles**: `authenticated`
- **Policy Definition** (USING expression):
```sql
bucket_id = 'registration-documents'
```
- **WITH CHECK expression**:
```sql
bucket_id = 'registration-documents'
```

#### Policy 4: Authenticated Delete (DELETE)
- **Policy Name**: `Authenticated users can delete documents`
- **Allowed Operation**: `DELETE`
- **Target Roles**: `authenticated`
- **Policy Definition** (USING expression):
```sql
bucket_id = 'registration-documents'
```

### Alternative: Use Storage API (if Dashboard doesn't work)

If the Dashboard UI doesn't allow you to create policies, you can use the Supabase Management API or create a helper script. However, the easiest solution is:

### Quick Fix: Make Bucket Public

**The simplest solution is to make the bucket public:**
1. Go to **Storage** → **`registration-documents`** bucket
2. Click **Settings**
3. Toggle **"Public bucket"** to **ON**
4. Save

This will automatically allow public read access, which should fix the 400 error.

**Note:** Making the bucket public means anyone with the URL can access the documents. If you need more security, you'll need to:
- Keep the bucket private
- Modify the code to use signed URLs instead of public URLs
- Set up proper authenticated policies (requires admin access)

### Verify the Fix

After configuring the policies or making the bucket public:
1. Try viewing a profile document again
2. The 400 error should be resolved
3. Documents should load correctly

## Code Alternative (Signed URLs for Private Buckets)

If you want to keep the bucket private and use signed URLs instead, you would need to update the code in `src/services/user.js`:

```javascript
// Replace getPublicUrl() with createSignedUrl()
const { data: urlData, error: urlError } = await supabase.storage
  .from('registration-documents')
  .createSignedUrl(filePath, 3600) // URL valid for 1 hour

return { data: { path: filePath, url: urlData.signedUrl }, error: null }
```

However, this requires regenerating signed URLs periodically, which adds complexity.

