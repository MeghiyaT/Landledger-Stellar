-- Add blockchain anchoring columns to registrations table
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS blockchain_id TEXT,
ADD COLUMN IF NOT EXISTS blockchain_tx_hash TEXT;

-- Index for faster verification lookups
CREATE INDEX IF NOT EXISTS idx_registrations_blockchain_id ON registrations(blockchain_id);
