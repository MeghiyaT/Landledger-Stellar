-- Migration: Add features to properties table
-- Run this in your Supabase SQL Editor

-- Add view_count column for analytics
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- Add status column (active, paused, sold, rented)
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Add constraint to ensure status is valid
ALTER TABLE properties 
ADD CONSTRAINT check_property_status 
CHECK (status IN ('active', 'paused', 'sold', 'rented'));

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_view_count ON properties(view_count);

-- Add comments
COMMENT ON COLUMN properties.view_count IS 'Number of times this property has been viewed';
COMMENT ON COLUMN properties.status IS 'Property listing status: active, paused, sold, or rented';

SELECT 'Properties table updated successfully!' as message;






