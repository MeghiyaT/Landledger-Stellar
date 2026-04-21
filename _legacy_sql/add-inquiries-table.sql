-- Migration: Create inquiries/messages table
-- Run this in your Supabase SQL Editor

-- Create inquiries table for buyer messages
CREATE TABLE IF NOT EXISTS inquiries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  user_id TEXT, -- Clerk user ID of the person making inquiry (nullable for anonymous)
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_phone TEXT,
  message TEXT,
  status TEXT DEFAULT 'new', -- 'new', 'read', 'replied', 'closed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_inquiries_property_id ON inquiries(property_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_user_id ON inquiries(user_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);

-- Enable Row Level Security
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- Policy: Property owners can view inquiries for their properties
CREATE POLICY "Property owners can view their property inquiries" ON inquiries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM properties 
      WHERE properties.id = inquiries.property_id 
      AND properties.user_id = public.clerk_user_id()
    )
  );

-- Policy: Users can create inquiries
CREATE POLICY "Users can create inquiries" ON inquiries
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = public.clerk_user_id()
  );

-- Policy: Property owners can update inquiry status
CREATE POLICY "Property owners can update inquiry status" ON inquiries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM properties 
      WHERE properties.id = inquiries.property_id 
      AND properties.user_id = public.clerk_user_id()
    )
  );

-- Add comment
COMMENT ON TABLE inquiries IS 'Buyer inquiries/messages for property listings';

SELECT 'Inquiries table created successfully!' as message;






