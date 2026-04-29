-- ============================================================
-- Force-fix: Drop ALL existing notification policies and recreate
-- them cleanly. The INSERT policy MUST allow any authenticated
-- user so that buyer→owner notification delivery works.
-- ============================================================

-- Drop every known policy name (old and new) so we start fresh
DROP POLICY IF EXISTS "Anyone can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert own notifications or admins insert any" ON notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON notifications;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;

-- Make sure RLS is actually enabled on the table
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- INSERT: allow ANY user to create a notification (cross-user delivery)
CREATE POLICY "notifications_insert_anyone"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- SELECT: only the recipient can read their own notifications
CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT
  USING (public.clerk_user_id() = user_id);

-- UPDATE: only the recipient can mark their own notifications as read
CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  USING (public.clerk_user_id() = user_id)
  WITH CHECK (public.clerk_user_id() = user_id);

-- DELETE: only the recipient can delete their own notifications
CREATE POLICY "notifications_delete_own"
  ON notifications FOR DELETE
  USING (public.clerk_user_id() = user_id);
