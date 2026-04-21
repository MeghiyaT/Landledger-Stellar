# Property NFT Integration Guide

## Overview

This document describes the ERC721 NFT integration for properties. When a property is registered on the blockchain, an NFT (Non-Fungible Token) is automatically minted. When a property is sold, the NFT ownership is transferred to the buyer on the blockchain.

## Features

### 1. NFT Minting on Property Registration
- **When**: Automatically when a property is registered on blockchain
- **Location**: `src/pages/SellProperty.jsx`
- **Process**:
  1. Property is registered on blockchain (PropertyRegistry contract)
  2. NFT is minted for the property (PropertyNFT contract)
  3. NFT token ID and metadata are stored in the database
- **Token URI**: Uses IPFS hash if available, otherwise property URL

### 2. NFT Transfer on Property Sale
- **When**: Automatically when a transaction is completed (status = 'completed')
- **Location**: `src/services/transactions.js`
- **Process**:
  1. Property ownership is transferred in database
  2. NFT ownership is transferred on blockchain to buyer's wallet
  3. Transfer transaction hash is stored in database

## Smart Contract

### PropertyNFT Contract
- **Type**: ERC721 (Non-Fungible Token)
- **Location**: `contracts/PropertyNFT.sol`
- **Features**:
  - Mint NFTs for properties
  - Transfer NFT ownership
  - Query NFT owner by property ID
  - Query property ID by token ID
  - Check if property has an NFT

### Key Functions

#### `mintPropertyNFT(address to, uint256 propertyId, string memory tokenURI)`
- Mints a new NFT for a property
- Only callable by contract owner
- Maps property ID to token ID

#### `transferPropertyNFT(uint256 propertyId, address to)`
- Transfers NFT ownership to new owner
- Callable by current NFT owner
- Emits `PropertyNFTTransferred` event

#### `getPropertyNFTOwner(uint256 propertyId)`
- Returns the current owner of a property's NFT

## Database Schema

### Properties Table - NFT Columns

Run the migration: `migration-add-nft-columns.sql`

Added columns:
- `nft_token_id` (TEXT): NFT token ID
- `nft_contract_address` (TEXT): PropertyNFT contract address
- `nft_token_uri` (TEXT): IPFS hash or metadata URI
- `nft_mint_tx_hash` (TEXT): Transaction hash when NFT was minted
- `nft_transfer_tx_hash` (TEXT): Transaction hash when NFT was transferred

## Deployment

### 1. Deploy NFT Contract

```bash
npm run deploy:nft
```

This will:
- Deploy PropertyNFT contract to Sepolia testnet
- Save contract address to `deployment-addresses.json`
- Contract owner will be the deployer address

### 2. Update Frontend Configuration

The frontend automatically reads contract addresses from `deployment-addresses.json`. If you need to use environment variables:

```env
VITE_PROPERTY_NFT_ADDRESS=0x...
```

### 3. Run Database Migration

Run `migration-add-nft-columns.sql` in your Supabase SQL Editor to add NFT columns to the properties table.

## Usage Flow

### Property Registration Flow

1. User fills out property listing form
2. Property is registered on blockchain (PropertyRegistry)
3. NFT is automatically minted for the property
4. NFT token ID and metadata are saved to database
5. Property listing is created in Supabase

### Property Sale Flow

1. Buyer makes an offer
2. Seller accepts offer
3. Transaction is created
4. When transaction is marked as completed:
   - Property ownership transferred in database
   - NFT ownership transferred on blockchain to buyer
   - Transfer transaction hash saved to database

## Frontend Integration

### Services

#### `src/services/contracts.js`

New functions:
- `mintPropertyNFT(toAddress, propertyId, tokenURI)` - Mint NFT
- `transferPropertyNFT(propertyId, toAddress)` - Transfer NFT
- `getPropertyNFTTokenId(propertyId)` - Get token ID
- `getPropertyNFTOwner(propertyId)` - Get NFT owner
- `hasPropertyNFT(propertyId)` - Check if property has NFT

### Example Usage

```javascript
import { mintPropertyNFT, transferPropertyNFT } from './services/contracts'

// Mint NFT (automatically called during property registration)
const nftResult = await mintPropertyNFT(
  walletAddress,
  blockchainPropertyId,
  'ipfs://Qm...' // or property URL
)

// Transfer NFT (automatically called during sale completion)
const transferResult = await transferPropertyNFT(
  blockchainPropertyId,
  buyerWalletAddress
)
```

## Error Handling

- NFT minting failures don't block property creation
- NFT transfer failures don't block property ownership transfer
- All errors are logged to console
- Users are notified of NFT-related errors but can continue

## Security Considerations

1. **Access Control**: Only contract owner can mint NFTs
2. **Ownership Verification**: NFT transfers verify current owner
3. **Reentrancy Protection**: Contract uses ReentrancyGuard
4. **Input Validation**: All inputs are validated

## Future Enhancements

Potential improvements:
- NFT metadata stored on IPFS with property details
- NFT images generated from property photos
- NFT marketplace integration
- Batch NFT operations
- NFT royalty system

## Troubleshooting

### NFT Not Minting
- Check PropertyNFT contract is deployed
- Verify contract address in `deployment-addresses.json`
- Check wallet is connected and on Sepolia network
- Verify property was registered on blockchain first

### NFT Not Transferring
- Check buyer has wallet address in profile
- Verify NFT exists for the property
- Check seller is the current NFT owner
- Verify transaction is marked as completed

### Contract Address Not Found
- Run `npm run deploy:nft` to deploy contract
- Check `deployment-addresses.json` exists
- Verify environment variables if using them

## Resources

- [OpenZeppelin ERC721 Documentation](https://docs.openzeppelin.com/contracts/4.x/erc721)
- [Ethereum NFT Standards](https://eips.ethereum.org/EIPS/eip-721)
- [Sepolia Testnet Explorer](https://sepolia.etherscan.io)

