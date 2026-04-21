# Auto-Populate Aadhar and PAN Cards from Profile

## Overview

When users reach Step 3 of the registration form, the system now automatically populates Aadhar Card and PAN Card fields from their profile if:
1. The documents are uploaded in their profile (Dashboard → Profile tab)
2. The fields are empty in the registration form
3. The user is not in edit mode

## How It Works

### When Entering Step 3

1. **Automatic Detection**: When the user navigates to Step 3 (Documents section), the system checks:
   - If user is logged in
   - If not in edit mode
   - If Aadhar/PAN fields are empty

2. **Profile Data Loading**: The system fetches the user's profile data from Supabase

3. **Auto-Population**: If profile has documents and form fields are empty:
   - Aadhar Card: Auto-populated from `profile.aadhar_card`
   - PAN Card: Auto-populated from `profile.pan_card`

4. **Visual Feedback**: A blue info banner appears at the top of Step 3 showing:
   > "Some documents have been auto-populated from your profile. You can update them if needed."

### User Experience

- **Seamless**: Documents appear automatically when entering Step 3
- **Non-intrusive**: Users can still upload new documents or remove auto-populated ones
- **Flexible**: If user has already uploaded documents in the form, those take precedence
- **Edit Mode**: Auto-population is disabled in edit mode to preserve existing data

## Technical Implementation

### Code Location
- **File**: `src/pages/Registration.jsx`
- **Function**: `useEffect` hook (lines 80-110)
- **Trigger**: When `currentStep === 3`

### Data Structure

Auto-populated documents use this structure:
```javascript
{
  url: "https://supabase-storage-url/...",
  name: "Aadhar Card" // or "PAN Card"
}
```

### Submission Handling

During form submission, the system handles both:
- **New uploads**: File objects (uploaded in the form)
- **Auto-populated**: Objects with `url` property (from profile)

Both types are processed correctly in the `handleSubmit` function.

## Benefits

1. **Faster Registration**: Users don't need to re-upload documents they've already uploaded to their profile
2. **Better UX**: Reduces repetitive data entry
3. **Consistency**: Ensures same documents are used across registrations
4. **Flexibility**: Users can still override with new documents if needed

## Testing Checklist

- [ ] Upload Aadhar Card to profile (Dashboard → Profile)
- [ ] Upload PAN Card to profile (Dashboard → Profile)
- [ ] Start new registration
- [ ] Navigate to Step 3
- [ ] Verify Aadhar and PAN cards are auto-populated
- [ ] Verify blue info banner appears
- [ ] Verify documents can be removed/replaced
- [ ] Verify form submission works with auto-populated documents
- [ ] Test edit mode (should NOT auto-populate)

## Notes

- Auto-population only works for **new registrations** (not edit mode)
- Documents must be uploaded to profile first (Dashboard → Profile tab)
- If user removes auto-populated document, they can upload a new one
- The system checks for both `null` and missing `url` properties to determine if field is empty

