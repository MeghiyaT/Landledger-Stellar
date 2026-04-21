-- Migration: Add Aadhar Card, PAN Card, and Property Document columns to registrations table
-- Run this in your Supabase SQL Editor

-- Add aadhar_card column to store Aadhar card document URL
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS aadhar_card TEXT;

-- Add pan_card column to store PAN card document URL
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS pan_card TEXT;

-- Add property_document column to store Property document URL
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS property_document TEXT;

-- Add comments
COMMENT ON COLUMN registrations.aadhar_card IS 'URL to the Aadhar Card document (required)';
COMMENT ON COLUMN registrations.pan_card IS 'URL to the PAN Card document (required)';
COMMENT ON COLUMN registrations.property_document IS 'URL to the Property Document (required)';

SELECT 'Registrations table updated with Aadhar Card, PAN Card, and Property Document fields!' as message;



