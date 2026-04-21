-- Migration: Add blockchain columns to property_offers table
-- Run this in your Supabase SQL Editor

-- Add blockchain offer ID and transaction hash columns
ALTER TABLE property_offers
ADD COLUMN IF NOT EXISTS blockchain_offer_id TEXT,
ADD COLUMN IF NOT EXISTS blockchain_tx_hash TEXT;

-- Add index for faster queries on blockchain offer ID
CREATE INDEX IF NOT EXISTS idx_offers_blockchain_id ON property_offers(blockchain_offer_id);

-- Add comment to explain the columns
COMMENT ON COLUMN property_offers.blockchain_offer_id IS 'On-chain offer ID from PropertyOffers contract';
COMMENT ON COLUMN property_offers.blockchain_tx_hash IS 'Transaction hash of the blockchain offer creation';



