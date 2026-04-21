# Troubleshooting: Profiles 400 Error

## The Error
```
POST https://...supabase.co/rest/v1/profiles?select=* 400 (Bad Request)
```

## Root Cause
This error occurs when profile operations try to use the regular Supabase client which is blocked by RLS policies.

## ✅ SOLUTION STEPS

### Step 1: Verify Service Role Key is Configured

1. **Check your `.env` file** - Make sure you have:
   ```
   VITE_SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key_here
   ```

2. **Get your service role key**:
   - Go to Supabase Dashboard
   - Settings → API
   - Copy the `service_role` key (NOT the anon key!)
   - Add it to your `.env` file

### Step 2: Restart Dev Server

**CRITICAL**: Environment variables are only loaded when the dev server starts!

```bash
# Stop your dev server (Ctrl+C)
# Then restart:
npm run dev
```

### Step 3: Hard Refresh Browser

Clear cache and reload:
- **Windows/Linux**: `Ctrl + Shift + R` or `Ctrl + F5`
- **Mac**: `Cmd + Shift + R`

### Step 4: Check Browser Console

Open browser DevTools (F12) and check for:
- ✅ **Good sign**: No errors about service role key
- ❌ **Bad sign**: Warnings like "⚠️ Supabase Service Role Key not configured"

If you see warnings, the service role key is not being loaded properly.

### Step 5: Verify Code Changes

All profile operations should now use `supabaseStorage`:
- ✅ `src/services/user.js` - uses `supabaseStorage`
- ✅ `src/services/escrow.js` - uses `supabaseStorage`
- ✅ `src/services/offers.js` - uses `supabaseStorage`
- ✅ `src/services/transactions.js` - uses `supabaseStorage`
- ✅ `src/utils/admin.js` - uses `supabaseStorage`

## Why This Happens

The error occurs because:
1. Profile operations are trying to INSERT/UPDATE/SELECT from `profiles` table
2. RLS policies block the operation when using Clerk JWT tokens
3. The service role key bypasses RLS, allowing all operations

## Verification

After following all steps, you should:
1. ✅ See no 400 errors in browser console
2. ✅ Profile operations work correctly
3. ✅ No warnings about service role key in console

## If Still Getting Errors

1. **Double-check `.env` file** - Make sure key is correct and file is in project root
2. **Restart dev server** - Environment variables only load on startup
3. **Check browser console** - Look for specific error messages
4. **Verify Supabase project** - Make sure you're using the correct project URL and keys

## Important Note

The service role key is exposed client-side (via `VITE_*` environment variables). This works for development but should be moved to a backend API in production for better security.



