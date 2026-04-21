-- Migration: Create inquiry_replies table for owner responses
-- Run this in your Supabase SQL Editor

-- Create inquiry_replies table
CREATE TABLE IF NOT EXISTS inquiry_replies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  inquiry_id UUID REFERENCES inquiries(id) ON DELETE CASCADE NOT NULL,
  sender_id TEXT NOT NULL, -- Clerk user ID (owner or buyer)
  sender_type TEXT NOT NULL CHECK (sender_type IN ('owner', 'buyer')),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_inquiry_replies_inquiry_id ON inquiry_replies(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_replies_sender_id ON inquiry_replies(sender_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_replies_created_at ON inquiry_replies(created_at);

-- Enable Row Level Security
ALTER TABLE inquiry_replies ENABLE ROW LEVEL SECURITY;

-- Policy: Property owners can view replies for their property inquiries
CREATE POLICY "Owners can view replies to their property inquiries" ON inquiry_replies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM inquiries
      INNER JOIN properties ON properties.id = inquiries.property_id
      WHERE inquiry_replies.inquiry_id = inquiries.id
      AND properties.user_id = public.clerk_user_id()
    )
  );

-- Policy: Buyers can view replies to their inquiries
CREATE POLICY "Buyers can view replies to their inquiries" ON inquiry_replies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM inquiries
      WHERE inquiry_replies.inquiry_id = inquiries.id
      AND inquiries.user_id = public.clerk_user_id()
    )
  );

-- Policy: Property owners can create replies to inquiries
CREATE POLICY "Owners can create replies" ON inquiry_replies
  FOR INSERT WITH CHECK (
    sender_type = 'owner' AND
    EXISTS (
      SELECT 1 FROM inquiries
      INNER JOIN properties ON properties.id = inquiries.property_id
      WHERE inquiry_replies.inquiry_id = inquiries.id
      AND properties.user_id = public.clerk_user_id()
      AND sender_id = public.clerk_user_id()
    )
  );

-- Policy: Buyers can create replies to their inquiries
CREATE POLICY "Buyers can create replies" ON inquiry_replies
  FOR INSERT WITH CHECK (
    sender_type = 'buyer' AND
    EXISTS (
      SELECT 1 FROM inquiries
      WHERE inquiry_replies.inquiry_id = inquiries.id
      AND inquiries.user_id = public.clerk_user_id()
      AND sender_id = public.clerk_user_id()
    )
  );

-- Add comment
COMMENT ON TABLE inquiry_replies IS 'Replies/messages between property owners and buyers for inquiries';

SELECT 'Inquiry replies table created successfully!' as message;





