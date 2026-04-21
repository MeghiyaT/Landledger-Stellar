-- Migration: Add registration_id to properties table
-- Run this in your Supabase SQL Editor
-- This links properties to approved registrations, preventing unregistered land from being sold

-- Add registration_id column (foreign key to registrations table)
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS registration_id UUID REFERENCES registrations(id);

-- Add comment
COMMENT ON COLUMN properties.registration_id IS 'Links this property listing to an approved registration record. Required to prevent selling unregistered land.';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_properties_registration_id ON properties(registration_id);

-- Optional: Add constraint to ensure registration is approved (if you want to enforce this at DB level)
-- Note: This is handled in the application layer, but you can add this for extra safety
-- ALTER TABLE properties 
-- ADD CONSTRAINT check_registration_approved 
-- CHECK (
--   registration_id IS NULL OR 
--   EXISTS (SELECT 1 FROM registrations WHERE id = registration_id AND status = 'approved')
-- );

SELECT 'Registration ID column added to properties table!' as message;




