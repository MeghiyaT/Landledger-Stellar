-- Migration: Add additional_notes column to registrations table
-- Run this in your Supabase SQL Editor

-- Add additional_notes column (nullable)
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS additional_notes TEXT;

-- Add a comment to document this column
COMMENT ON COLUMN registrations.additional_notes IS 'Optional additional notes or instructions from the property owner';







