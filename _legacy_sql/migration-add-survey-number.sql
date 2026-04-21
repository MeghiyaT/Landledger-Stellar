-- Migration: Add survey_number to registrations table
-- Run this in your Supabase SQL Editor

-- Add survey_number column (critical for land identification)
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS survey_number TEXT;

-- Add comment
COMMENT ON COLUMN registrations.survey_number IS 'Survey Number - Critical identifier for land properties. Format varies by state (e.g., "125/3", "45/2/1")';

-- Create index for faster searches
CREATE INDEX IF NOT EXISTS idx_registrations_survey_number ON registrations(survey_number);

SELECT 'Survey number column added to registrations table!' as message;







