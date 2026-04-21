-- Migration: Add blockchain columns to properties table
-- Run this in your Supabase SQL Editor

-- Add blockchain property ID and transaction hash columns
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS blockchain_property_id TEXT,
ADD COLUMN IF NOT EXISTS blockchain_tx_hash TEXT;

-- Add index for faster queries on blockchain property ID
CREATE INDEX IF NOT EXISTS idx_properties_blockchain_id ON properties(blockchain_property_id);

-- Add comment to explain the columns
COMMENT ON COLUMN properties.blockchain_property_id IS 'On-chain property ID from PropertyRegistry contract';
COMMENT ON COLUMN properties.blockchain_tx_hash IS 'Transaction hash of the blockchain registration';



