# Correct Storage Setup Instructions

## The Issue
Supabase Storage policies are NOT managed through Database → Tables. They're managed through the **Storage** section.

## Step-by-Step Setup

### Step 1: Create the Bucket (if it doesn't exist)
1. Go to **Supabase Dashboard** → **Storage** (left sidebar)
2. Click **New Bucket** button
3. **Bucket Name**: `property-images` (exact, case-sensitive)
4. **Public bucket**: Toggle **ON** (very important!)
5. Click **Create bucket**

### Step 2: Create Storage Policies
Storage policies are created in the Storage section, NOT in Database:

1. Go to **Storage** → Click on the `property-images` bucket
2. Click on the **Policies** tab (at the top of the bucket page)
3. You should see a list of policies or a message to create one
4. Click **New Policy** button

#### Create Policy 1: INSERT (Upload)
- **Policy name**: `Allow authenticated uploads`
- **Allowed operation**: Select **INSERT**
- **Target roles**: Select **authenticated**
- **Policy definition**:
  - **USING expression**: Leave empty or `true`
  - **WITH CHECK expression**: `bucket_id = 'property-images'`
- Click **Review** then **Save policy**

#### Create Policy 2: SELECT (Read)
- **Policy name**: `Allow public read`
- **Allowed operation**: Select **SELECT**
- **Target roles**: Select **public**
- **Policy definition**:
  - **USING expression**: `bucket_id = 'property-images'`
  - **WITH CHECK expression**: Leave empty
- Click **Review** then **Save policy**

#### Create Policy 3: UPDATE
- **Policy name**: `Allow authenticated update`
- **Allowed operation**: Select **UPDATE**
- **Target roles**: Select **authenticated**
- **Policy definition**:
  - **USING expression**: `bucket_id = 'property-images'`
  - **WITH CHECK expression**: `bucket_id = 'property-images'`
- Click **Review** then **Save policy**

#### Create Policy 4: DELETE
- **Policy name**: `Allow authenticated delete`
- **Allowed operation**: Select **DELETE**
- **Target roles**: Select **authenticated**
- **Policy definition**:
  - **USING expression**: `bucket_id = 'property-images'`
  - **WITH CHECK expression**: Leave empty
- Click **Review** then **Save policy**

### Step 3: Verify Policies
After creating all 4 policies, you should see them listed in the **Policies** tab of the bucket.

### Step 4: Test Upload
Try uploading an image in your app. It should work now!

## If You Still Get Errors

### Check 1: Is the bucket public?
- Go to Storage → `property-images` bucket
- Check if "Public bucket" toggle is **ON**
- If not, click the three dots (⋯) → **Edit bucket** → Toggle **Public** to ON

### Check 2: Are you logged in?
- Make sure you're authenticated in your app
- Check browser console for authentication errors

### Check 3: Check JWT Token
1. Open browser DevTools (F12) → **Network** tab
2. Try uploading an image
3. Find the failed request
4. Check **Headers** → **Request Headers**
5. Look for `Authorization: Bearer ...`
6. If missing, Clerk token isn't being sent

## Alternative: Use Template Policy

If the manual policy creation doesn't work, try using Supabase's template:

1. In the **Policies** tab, click **New Policy**
2. Look for **"Use a template"** option
3. Select **"Allow authenticated users to upload files"**
4. Modify the bucket_id check if needed

## Still Not Working?

If policies still don't work, the issue might be:
1. Clerk JWT not being recognized by Supabase
2. Need to configure Clerk as a JWT issuer in Supabase
3. May need to use Supabase Auth instead of Clerk for storage operations

In that case, consider:
- Using a different storage service (AWS S3, Cloudinary)
- Or configuring Clerk JWT properly in Supabase Settings → API → JWT Settings



