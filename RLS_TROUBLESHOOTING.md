# RLS Policy Troubleshooting Guide

## Problem
Getting error: "new row violates row-level security policy for table 'properties'"

## Root Cause
The `properties` table has RLS enabled but was missing INSERT, UPDATE, and DELETE policies.

## Solution Steps

### Step 1: Run the Main Migration
Run `add-properties-rls-policies.sql` in your Supabase SQL Editor.

### Step 2: If Still Getting Errors

The issue might be that Supabase isn't parsing the Clerk JWT correctly. Check:

1. **Verify JWT is being sent:**
   - Open browser console
   - Check Network tab when creating a property
   - Verify the `Authorization: Bearer <token>` header is present

2. **Test JWT parsing in Supabase:**
   Run this in Supabase SQL Editor (while logged in):
   ```sql
   SELECT public.debug_jwt_claims();
   ```
   If this returns NULL or empty, Supabase isn't parsing your Clerk JWT.

3. **Configure Supabase to Accept Clerk JWTs:**
   
   **Option A: Use Clerk JWT Template (Recommended)**
   - In Clerk Dashboard → JWT Templates
   - Create a template named "supabase"
   - Use Supabase's JWT Secret (found in Supabase Dashboard → Settings → API → JWT Settings)
   - The code already tries to use this template first
   
   **Option B: Configure Supabase JWT Secret**
   - In Supabase Dashboard → Settings → API → JWT Settings
   - Set the JWT Secret to match Clerk's JWT signing key
   - This allows Supabase to verify Clerk JWTs

### Step 3: Use Simple Fallback Policy

If JWT parsing still doesn't work, use `fix-properties-rls-simple.sql` which has a more permissive policy.

**⚠️ Warning:** The simple policy is less secure. Only use it if:
- You're validating user_id on the application side
- You trust your authentication layer
- You're okay with slightly relaxed security

### Step 4: Verify Policies Were Created

Run this in Supabase SQL Editor:
```sql
SELECT 
  policyname,
  cmd,
  with_check
FROM pg_policies 
WHERE tablename = 'properties'
ORDER BY cmd, policyname;
```

You should see:
- SELECT policy (already existed)
- INSERT policy (new)
- UPDATE policy (new)
- DELETE policy (new)

## Common Issues

### Issue 1: `clerk_user_id()` returns NULL
**Solution:** Supabase isn't parsing the JWT. Configure JWT secret or use simple policy.

### Issue 2: Policy exists but still getting errors
**Solution:** 
- Check that you're logged in (JWT is being sent)
- Verify `user_id` in the insert matches your Clerk user ID
- Check browser console for the actual error message

### Issue 3: Works for some users but not others
**Solution:** 
- Check if those users have profiles in the `profiles` table
- Verify their Clerk user IDs match what's in the database

## Testing

After applying the migration:

1. Log in to your app
2. Try to create a property
3. Check browser console for errors
4. If it fails, run the debug function:
   ```sql
   SELECT public.debug_jwt_claims();
   ```

## Need More Help?

If the issue persists:
1. Check Supabase logs (Dashboard → Logs)
2. Verify Clerk JWT template is configured correctly
3. Ensure Supabase JWT secret matches Clerk's signing key
4. Consider temporarily disabling RLS for testing (not recommended for production)





