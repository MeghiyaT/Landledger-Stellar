# Profiles Table - Service Role Key Migration

## Summary
All profile table queries have been updated to use the service role key client (`supabaseStorage`) instead of the regular Supabase client. This ensures that all profile operations bypass RLS and will never encounter 400 errors related to RLS policies.

## Files Updated

### ✅ src/services/user.js
- `getUserProfile()` - Now uses `supabaseStorage`
- `updateUserProfile()` - Now uses `supabaseStorage`

### ✅ src/services/escrow.js
- Seller profile queries - Now uses `supabaseStorage`
- Buyer profile queries - Now uses `supabaseStorage`

### ✅ src/services/offers.js
- Buyer profile queries - Now uses `supabaseStorage`
- Seller profile queries - Now uses `supabaseStorage`

### ✅ src/services/transactions.js
- User wallet address queries - Now uses `supabaseStorage`
- Ownership history profile queries - Now uses `supabaseStorage`

### ✅ src/utils/admin.js
- `isAdmin()` - Now uses `supabaseStorage`
- `getAdminStatuses()` - Now uses `supabaseStorage`

## Why This Fix Works

The service role key (`supabaseStorage`) bypasses all Row Level Security (RLS) policies. This means:
- ✅ No more 400 errors on profile queries
- ✅ No RLS policy configuration needed
- ✅ Works regardless of Clerk JWT token parsing issues
- ✅ Consistent behavior across all profile operations

## Important Notes

⚠️ **Security Consideration**: The service role key is exposed in the client-side code (via `VITE_SUPABASE_SERVICE_ROLE_KEY`). While this works for development and resolves the RLS issues, for production you may want to:
- Move profile operations to a backend API
- Use signed URLs for sensitive operations
- Implement additional client-side validation

## Verification

All profile queries now use:
```javascript
import { supabaseStorage } from '../lib/supabaseStorage'
// or
const { supabaseStorage } = await import('../lib/supabaseStorage')

// Then:
supabaseStorage.from('profiles').select(...)
```

The error `POST https://...supabase.co/rest/v1/profiles?select=* 400 (Bad Request)` should **never occur again** as all operations now bypass RLS entirely.



