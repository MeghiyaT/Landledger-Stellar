-- Migration: Add property_title column to registrations table
-- This allows users to give a custom title to their property during registration

ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS property_title TEXT;
