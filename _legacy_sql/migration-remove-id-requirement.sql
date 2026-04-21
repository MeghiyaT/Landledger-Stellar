-- Migration: Make owner_id_number optional in registrations table
-- Run this in your Supabase SQL Editor

-- Make owner_id_number nullable
ALTER TABLE registrations 
ALTER COLUMN owner_id_number DROP NOT NULL;

-- Add a comment to document this change
COMMENT ON COLUMN registrations.owner_id_number IS 'Optional ID number of the property owner (nullable)';







