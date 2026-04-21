# Notifications Not Working - Fix Guide

## Problem

Notifications are not being created in the database when events occur (offers, transactions, registrations, etc.). Users don't see notifications in the NotificationCenter component.

## Root Cause

The Row Level Security (RLS) policy on the `notifications` table is too restrictive. The policy requires:

```sql
public.clerk_user_id() = user_id
```

This means the notification can only be created if the current user's JWT user_id matches the notification's `user_id`. However, when the system creates notifications:

- **Buyer makes offer** → Notification should be created for the **seller** (different user_id)
- **Seller accepts offer** → Notification should be created for the **buyer** (different user_id)
- **Admin approves registration** → Notification should be created for the **property owner** (different user_id)

Since the creator's JWT user_id doesn't match the recipient's user_id, the RLS policy blocks the INSERT operation.

## Solution

### Step 1: Run the SQL Fix

Run the SQL migration file `fix-notifications-rls.sql` in your Supabase SQL Editor:

```sql
-- This allows any authenticated user to create notifications
-- The system needs this because it creates notifications for other users
CREATE POLICY "Authenticated users can insert notifications" ON notifications
  FOR INSERT WITH CHECK (
    current_setting('request.jwt.claims', true) IS NOT NULL
    AND user_id IS NOT NULL
  );
```

### Step 2: Verify the Fix

1. **Test notification creation:**
   - Make an offer on a property (should create notification for seller)
   - Accept an offer (should create notification for buyer)
   - Approve a registration (should create notification for owner)

2. **Check browser console:**
   - Look for `🔔 Creating notification:` logs
   - Check for `✅ Notification created successfully:` or `❌ Notification creation failed:` messages

3. **Check Supabase:**
   - Go to Supabase Dashboard → Table Editor → `notifications`
   - Verify that notifications are being inserted

### Step 3: Verify RLS Policies

The SELECT and UPDATE policies should still work correctly:
- Users can only **view** their own notifications
- Users can only **update** (mark as read) their own notifications
- The INSERT policy now allows authenticated users to create notifications for any user

## Additional Improvements Made

1. **Enhanced error logging** in `src/services/notifications.js`:
   - Added console logs to track notification creation
   - Better error messages with details

2. **Notification types supported:**
   - `offer_received` - When seller receives an offer
   - `offer_accepted` - When buyer's offer is accepted
   - `offer_rejected` - When buyer's offer is rejected
   - `transaction_completed` - When transaction completes
   - `registration_approved` - When registration is approved
   - `registration_rejected` - When registration is rejected
   - `registration_in_review` - When registration goes under review
   - And more...

## Testing Checklist

- [ ] Run `fix-notifications-rls.sql` in Supabase
- [ ] Create an offer → Check seller receives notification
- [ ] Accept an offer → Check buyer receives notification
- [ ] Approve a registration → Check owner receives notification
- [ ] Check NotificationCenter component shows notifications
- [ ] Verify unread count badge appears
- [ ] Test marking notifications as read
- [ ] Check browser console for any errors

## If Notifications Still Don't Work

1. **Check Supabase logs:**
   - Go to Supabase Dashboard → Logs → Postgres Logs
   - Look for RLS policy violations

2. **Verify JWT is being sent:**
   - Check browser Network tab
   - Verify Authorization header is present in requests

3. **Test with service role key (temporarily):**
   - Use Supabase service role key to bypass RLS
   - If this works, the issue is definitely RLS-related

4. **Check notification table exists:**
   - Verify `notifications` table exists in Supabase
   - Verify columns match the schema in `notifications-migration.sql`

## Security Note

The new INSERT policy allows any authenticated user to create notifications for any user_id. This is intentional because:
- The application code controls who gets notified
- Users can only VIEW their own notifications (SELECT policy still enforces this)
- Users can only UPDATE their own notifications (UPDATE policy still enforces this)
- The system needs to create notifications for other users (buyer → seller, admin → user, etc.)

If you need stricter security, you could:
- Use Supabase Edge Functions with service role key
- Add application-level checks before creating notifications
- Use database triggers instead of application code

