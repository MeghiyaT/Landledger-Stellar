-- Migration: Add registration_number to properties table
-- Run this in your Supabase SQL Editor

-- Add registration_number column (links property to land registration)
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS registration_number TEXT;

-- Add comment
COMMENT ON COLUMN properties.registration_number IS 'Property Registration Number - Links this property listing to a land registration record';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_properties_registration_number ON properties(registration_number);

SELECT 'Registration number column added to properties table!' as message;







