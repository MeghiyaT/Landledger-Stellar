-- Migration: Add appointment scheduling and phone reveal to inquiries
-- Run this in your Supabase SQL Editor

-- Add columns to inquiries table for appointments and phone reveal
ALTER TABLE inquiries 
ADD COLUMN IF NOT EXISTS appointment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS appointment_time TEXT,
ADD COLUMN IF NOT EXISTS phone_revealed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS owner_phone TEXT; -- Store owner's phone when revealed

-- Add index for appointment queries
CREATE INDEX IF NOT EXISTS idx_inquiries_appointment_date ON inquiries(appointment_date) WHERE appointment_date IS NOT NULL;

-- Add comment
COMMENT ON COLUMN inquiries.appointment_date IS 'Scheduled viewing appointment date and time';
COMMENT ON COLUMN inquiries.phone_revealed IS 'Whether the owner phone number has been revealed to the buyer';
COMMENT ON COLUMN inquiries.owner_phone IS 'Owner phone number (revealed after inquiry)';

SELECT 'Inquiries table updated with appointment scheduling!' as message;





