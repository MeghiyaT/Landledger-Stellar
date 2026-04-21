# Auto-Populate Documents - Debugging Guide

## What Was Changed

The auto-populate functionality has been enhanced with:
1. **Comprehensive logging** - Console logs at every step
2. **Improved condition logic** - Better detection of when to auto-populate
3. **Ref tracking** - Prevents multiple auto-populate attempts

## How to Debug

### Step 1: Check Browser Console

1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Navigate to registration form → Step 3
4. Look for these log messages:

**Expected logs when entering Step 3:**
```
🔍 Step 3 detected - checking for profile documents...
📋 Profile data received: { hasAadhar: true/false, hasPan: true/false, ... }
📝 Current form data: { hasAadhar: true/false, hasPan: true/false, ... }
✅ Will auto-populate Aadhar Card from profile (if profile has it)
✅ Will auto-populate PAN Card from profile (if profile has it)
📄 Auto-populating documents from profile: { aadharCard: {...}, panCard: {...} }
```

### Step 2: Verify Profile Has Documents

1. Go to Dashboard → Profile tab
2. Check if Aadhar Card and PAN Card are uploaded
3. If not uploaded, upload them first
4. Then try registration again

### Step 3: Check Console for Errors

Look for these error messages:
- `❌ Error fetching profile:` - Profile fetch failed
- `❌ Error loading profile documents:` - Exception occurred
- `⚠️ No profile data found` - Profile doesn't exist

### Step 4: Verify Conditions

The auto-populate will NOT run if:
- ❌ User is in edit mode (`isEditMode === true`)
- ❌ User is not logged in (`!user?.id`)
- ❌ User data not loaded (`!isLoaded`)
- ❌ Not on Step 3 (`currentStep !== 3`)
- ❌ Documents already have File objects (user uploaded new files)
- ❌ Documents already have URLs (already populated)

## Common Issues

### Issue 1: No Console Logs
**Symptom**: No logs appear when entering Step 3

**Possible causes**:
- useEffect not triggering
- Condition not met (check all conditions above)
- JavaScript errors preventing execution

**Solution**: Check browser console for JavaScript errors

### Issue 2: Profile Data Not Found
**Symptom**: Log shows `⚠️ No profile data found`

**Possible causes**:
- Profile doesn't exist in database
- RLS policy blocking profile read
- getUserProfile returning error

**Solution**: 
- Check Supabase → Table Editor → profiles table
- Verify user has a profile record
- Check RLS policies

### Issue 3: Profile Has No Documents
**Symptom**: Log shows `ℹ️ Profile does not have Aadhar Card` or `ℹ️ Profile does not have PAN Card`

**Solution**: 
- Upload documents to profile first (Dashboard → Profile)
- Then try registration again

### Issue 4: Documents Already Set
**Symptom**: Log shows `ℹ️ Aadhar Card already has a URL, skipping auto-populate`

**Solution**: This is expected behavior - if documents are already set, they won't be overwritten

## Testing Steps

1. **Upload documents to profile:**
   - Go to Dashboard → Profile tab
   - Upload Aadhar Card
   - Upload PAN Card
   - Verify they appear in profile

2. **Start new registration:**
   - Go to Registration page
   - Fill Step 1 and Step 2
   - Navigate to Step 3

3. **Check console:**
   - Should see auto-populate logs
   - Documents should appear in form

4. **Verify documents appear:**
   - Aadhar Card should show as uploaded
   - PAN Card should show as uploaded
   - Blue info banner should appear

## Manual Test

If auto-populate still doesn't work, you can manually test in browser console:

```javascript
// Get user profile
const { data } = await getUserProfile('YOUR_USER_ID')
console.log('Profile data:', data)
console.log('Aadhar:', data?.aadhar_card)
console.log('PAN:', data?.pan_card)
```

Replace `YOUR_USER_ID` with your actual Clerk user ID.

## Next Steps

If it's still not working after checking all above:
1. Share the console logs
2. Verify profile has documents in Supabase
3. Check if there are any JavaScript errors
4. Verify the user ID matches between Clerk and Supabase profiles

