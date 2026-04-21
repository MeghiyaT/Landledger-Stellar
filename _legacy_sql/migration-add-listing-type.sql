-- Migration: Add listing_type column to properties table
-- Run this in your Supabase SQL Editor

-- Add listing_type column (for_sale or for_rent)
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS listing_type TEXT DEFAULT 'for_sale';

-- Add user_id column to track who listed the property
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Update existing properties to be 'for_sale' by default
UPDATE properties 
SET listing_type = 'for_sale' 
WHERE listing_type IS NULL;

-- Add constraint to ensure listing_type is either 'for_sale' or 'for_rent'
ALTER TABLE properties 
ADD CONSTRAINT check_listing_type 
CHECK (listing_type IN ('for_sale', 'for_rent'));

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_properties_listing_type ON properties(listing_type);

-- Add comment
COMMENT ON COLUMN properties.listing_type IS 'Whether the property is for sale or for rent';
COMMENT ON COLUMN properties.user_id IS 'Clerk user ID of the person who listed this property';

SELECT 'Properties table updated successfully with listing_type!' as message;







