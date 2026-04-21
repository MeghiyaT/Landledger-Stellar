-- Migration: Add property sale tracking
-- Run this in your Supabase SQL Editor
-- This tracks when properties are sold and to whom

-- Add sold_at and sold_to columns to properties table
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS sold_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sold_to TEXT; -- Clerk user ID of the buyer

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_properties_sold_at ON properties(sold_at);
CREATE INDEX IF NOT EXISTS idx_properties_sold_to ON properties(sold_to);

-- Add comment
COMMENT ON COLUMN properties.sold_at IS 'Timestamp when property was sold. NULL means not sold.';
COMMENT ON COLUMN properties.sold_to IS 'Clerk user ID of the buyer. NULL means not sold.';

SELECT 'Property sale tracking columns added successfully!' as message;


