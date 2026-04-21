-- Migration: Add ownership_history to properties table
-- Run this in your Supabase SQL Editor

-- Add ownership_history column (JSONB to store array of ownership records)
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS ownership_history JSONB DEFAULT '[]'::jsonb;

-- Add comment
COMMENT ON COLUMN properties.ownership_history IS 'Array of previous owners with dates. Format: [{"owner_name": "John Doe", "from_date": "2010-01-01", "to_date": "2020-12-31", "transfer_type": "sale"}]';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_properties_ownership_history ON properties USING GIN (ownership_history);

SELECT 'Properties table updated with ownership_history field!' as message;







