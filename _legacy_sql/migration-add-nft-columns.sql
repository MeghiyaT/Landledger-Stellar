-- Migration: Add NFT columns to properties table
-- Run this in your Supabase SQL Editor
-- This stores NFT token ID and related information for properties that have been minted as NFTs

-- Add NFT token ID column (links property to NFT token)
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS nft_token_id TEXT;

-- Add NFT contract address column (stores the NFT contract address)
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS nft_contract_address TEXT;

-- Add NFT token URI column (IPFS hash or metadata URI)
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS nft_token_uri TEXT;

-- Add NFT mint transaction hash column
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS nft_mint_tx_hash TEXT;

-- Add NFT transfer transaction hash column
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS nft_transfer_tx_hash TEXT;

-- Add comments
COMMENT ON COLUMN properties.nft_token_id IS 'NFT token ID for this property (ERC721)';
COMMENT ON COLUMN properties.nft_contract_address IS 'Address of the PropertyNFT contract';
COMMENT ON COLUMN properties.nft_token_uri IS 'IPFS hash or metadata URI for the NFT';
COMMENT ON COLUMN properties.nft_mint_tx_hash IS 'Blockchain transaction hash when NFT was minted';
COMMENT ON COLUMN properties.nft_transfer_tx_hash IS 'Blockchain transaction hash when NFT was transferred to new owner';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_properties_nft_token_id ON properties(nft_token_id);
CREATE INDEX IF NOT EXISTS idx_properties_nft_contract_address ON properties(nft_contract_address);

SELECT 'NFT columns added to properties table!' as message;

