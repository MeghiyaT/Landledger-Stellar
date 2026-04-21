-- Migration: Add state and 7/12 extract fields to registrations table
-- Run this in your Supabase SQL Editor

-- Add property_state column
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS property_state TEXT;

-- Add extract_712 column to store 7/12 extract document URL
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS extract_712 TEXT;

-- Add comments
COMMENT ON COLUMN registrations.property_state IS 'State where the property is located (required for 7/12 extract)';
COMMENT ON COLUMN registrations.extract_712 IS 'URL to the 7/12 Extract document (required for Maharashtra and Gujarat)';

-- Create index for faster filtering by state
CREATE INDEX IF NOT EXISTS idx_registrations_property_state ON registrations(property_state);

SELECT 'Registrations table updated with state and 7/12 extract fields!' as message;







