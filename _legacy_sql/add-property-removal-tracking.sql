-- Migration: Add admin removal tracking to properties table
-- Run this in your Supabase SQL Editor
--
-- This adds fields to track when and why an admin removes a property

-- ============================================================================
-- Add removal tracking columns
-- ============================================================================

-- Add columns to track admin removals
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS removed_by TEXT,
ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS removal_reason TEXT;

-- Add index for faster queries on removed properties
CREATE INDEX IF NOT EXISTS idx_properties_removed_at ON properties(removed_at) WHERE removed_at IS NOT NULL;

-- Add comment
COMMENT ON COLUMN properties.removed_by IS 'Clerk user ID of the admin who removed this property';
COMMENT ON COLUMN properties.removed_at IS 'Timestamp when the property was removed by admin';
COMMENT ON COLUMN properties.removal_reason IS 'Reason provided by admin for removing this property (e.g., fraud, policy violation)';

SELECT 'Property removal tracking columns added successfully!' as message;
