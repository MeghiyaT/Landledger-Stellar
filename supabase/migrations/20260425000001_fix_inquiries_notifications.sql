-- ============================================================
-- RUN THIS IN: Supabase Dashboard > SQL Editor
-- Purpose: Fix RLS 42501 permission error when submitting inquiries
-- ============================================================

-- Allow anyone to submit an inquiry (even guests or users whose tokens haven't fully synced)
DROP POLICY IF EXISTS "Users can create inquiries" ON inquiries;
CREATE POLICY "Users can create inquiries" ON inquiries FOR INSERT WITH CHECK (true);

-- Allow users to view inquiries they've made
DROP POLICY IF EXISTS "Users can view their own inquiries" ON inquiries;
CREATE POLICY "Users can view their own inquiries" ON inquiries FOR SELECT USING (
  user_id = public.clerk_user_id()
);

-- Ensure property owners can view inquiries on their properties
DROP POLICY IF EXISTS "Property owners can view their property inquiries" ON inquiries;
CREATE POLICY "Property owners can view their property inquiries" ON inquiries FOR SELECT USING (
  EXISTS (SELECT 1 FROM properties WHERE properties.id = inquiries.property_id AND properties.user_id = public.clerk_user_id())
);

-- Ensure property owners can update inquiry status
DROP POLICY IF EXISTS "Property owners can update inquiry status" ON inquiries;
CREATE POLICY "Property owners can update inquiry status" ON inquiries FOR UPDATE USING (
  EXISTS (SELECT 1 FROM properties WHERE properties.id = inquiries.property_id AND properties.user_id = public.clerk_user_id())
);
-- ============================================================
-- RUN THIS IN: Supabase Dashboard > SQL Editor
-- Purpose: Fix RLS 42501 permission error for notifications
-- ============================================================

-- Drop the restrictive insert policy
DROP POLICY IF EXISTS "Users can insert own notifications or admins insert any" ON notifications;
DROP POLICY IF EXISTS "Anyone can create notifications" ON notifications;

-- Create a new policy that allows anyone to insert a notification.
-- This is required because notifications are created client-side by the SENDER 
-- (e.g., a buyer sending an inquiry) but the notification's user_id belongs 
-- to the RECIPIENT (e.g., the property owner).
CREATE POLICY "Anyone can create notifications" ON notifications FOR INSERT WITH CHECK (true);

-- Ensure users can only read their OWN notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (
  public.clerk_user_id() = user_id
);

-- Ensure users can only update their OWN notifications
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (
  public.clerk_user_id() = user_id
) WITH CHECK (
  public.clerk_user_id() = user_id
);

-- Ensure users can only delete their OWN notifications
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications" ON notifications FOR DELETE USING (
  public.clerk_user_id() = user_id
);
-- ============================================================
-- RUN THIS IN: Supabase Dashboard > SQL Editor
-- Purpose: Allow buyers and property owners to delete inquiries
-- ============================================================

DROP POLICY IF EXISTS "Users can delete inquiries" ON inquiries;

CREATE POLICY "Users can delete inquiries" ON inquiries FOR DELETE USING (
  -- The person who sent the inquiry can delete it
  user_id = public.clerk_user_id() 
  OR
  -- The owner of the property can delete it
  EXISTS (
    SELECT 1 FROM properties 
    WHERE properties.id = inquiries.property_id 
    AND properties.user_id = public.clerk_user_id()
  )
);
