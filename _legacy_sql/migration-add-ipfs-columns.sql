-- Migration: Add IPFS columns to properties table
-- This allows storing IPFS Content Identifiers (CIDs) for decentralized storage

-- Add IPFS metadata CID column
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS ipfs_metadata_cid TEXT;

-- Add IPFS metadata URL (gateway URL for easy access)
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS ipfs_metadata_url TEXT;

-- Add IPFS image CIDs (array of CIDs for property images)
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS ipfs_image_cids TEXT[];

-- Add index for faster queries on IPFS CIDs
CREATE INDEX IF NOT EXISTS idx_properties_ipfs_metadata_cid 
ON properties(ipfs_metadata_cid) 
WHERE ipfs_metadata_cid IS NOT NULL;

-- Add comment to columns
COMMENT ON COLUMN properties.ipfs_metadata_cid IS 'IPFS Content Identifier (CID) for property metadata JSON';
COMMENT ON COLUMN properties.ipfs_metadata_url IS 'IPFS Gateway URL for accessing metadata';
COMMENT ON COLUMN properties.ipfs_image_cids IS 'Array of IPFS CIDs for property images';



