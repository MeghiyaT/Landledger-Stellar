-- Notifications System Migration
-- Run this in your Supabase SQL Editor

-- ============================================================================
-- STEP 1: Create notifications table
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'inquiry_message', 'inquiry_reply', 'property_sold', 'property_purchased', 'property_blockchain', 'amount_deducted', 'amount_received', 'offer_received', 'offer_accepted', 'offer_rejected', 'transaction_completed', 'transaction_failed', 'registration_submitted', 'registration_review', 'registration_approved', 'registration_rejected'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT, -- Optional link to related resource
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================================================
-- STEP 2: Enable Row Level Security
-- ============================================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 3: Create RLS policies for notifications
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert own notifications or admins insert any" ON notifications;

-- Policy: Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (public.clerk_user_id() = user_id);

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (public.clerk_user_id() = user_id)
  WITH CHECK (public.clerk_user_id() = user_id);

-- Policy: Users can insert their own notifications (for system-generated)
-- Policy: Admins can insert notifications for any user
CREATE POLICY "Users can insert own notifications or admins insert any" ON notifications
  FOR INSERT WITH CHECK (
    public.clerk_user_id() = user_id 
    OR public.is_admin(public.clerk_user_id())
  );

-- ============================================================================
-- STEP 4: Add estimated_review_days to registrations table
-- ============================================================================

ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS estimated_review_days INTEGER DEFAULT 5; -- Default 5 business days

-- ============================================================================
-- STEP 5: Add editable flag to registrations (for pending status)
-- ============================================================================

-- Note: We'll allow editing if status is 'pending' - no need for separate flag

SELECT 'Notifications system migration completed successfully!' as message;





