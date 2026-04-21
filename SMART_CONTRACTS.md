# Smart Contracts Documentation

This document describes the smart contracts deployed for the real estate platform.

## Contracts Overview

### 1. PropertyToken (ERC-20)
Custom token for the platform with the following features:
- **Symbol**: PROP
- **Name**: PropertyToken
- **Max Supply**: 1,000,000,000 PROP (1 billion)
- **Initial Supply**: 100,000,000 PROP (100 million)

**Features:**
- Standard ERC-20 functionality
- Burnable tokens
- Pausable transfers (for emergencies)
- Minting capability (controlled by owner and minters)

**Use Cases:**
- Platform rewards
- Payment for services
- Staking (future feature)

### 2. PropertyRegistry
On-chain registry for property ownership and management.

**Features:**
- Register new properties
- Track property ownership
- Transfer ownership
- List properties for sale
- Ownership history tracking

**Key Functions:**
- `registerProperty()` - Register a new property
- `transferOwnership()` - Transfer property to new owner
- `listForSale()` - Mark property as for sale
- `getProperty()` - Get property details
- `getOwnershipHistory()` - View ownership history

### 3. Escrow
Secure escrow service for property transactions.

**Features:**
- Hold funds (ETH or tokens) until transaction completes
- Automatic property transfer on completion
- Platform fee (default 2.5%)
- Support for both ETH and token payments
- Deadline-based transactions

**Key Functions:**
- `createEscrowETH()` - Create escrow with ETH payment
- `createEscrowToken()` - Create escrow with token payment
- `completeEscrow()` - Complete transaction (seller confirms)
- `cancelEscrow()` - Cancel and refund (buyer can cancel)

### 4. PropertyOffers
On-chain offer management system.

**Features:**
- Create property offers
- Accept/reject offers
- Withdraw offers
- Track offer history

**Key Functions:**
- `createOffer()` - Create a new offer
- `acceptOffer()` - Accept an offer (seller)
- `rejectOffer()` - Reject an offer (seller)
- `withdrawOffer()` - Withdraw an offer (buyer)

## Deployment

### Prerequisites
1. Install dependencies:
```bash
npm install
```

2. Set up environment variables in `.env`:
```env
# Sepolia Network
SEPOLIA_RPC_URL=https://rpc.sepolia.org
PRIVATE_KEY=your_private_key_here

# Or use Infura/Alchemy
# SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
```

### Compile Contracts
```bash
npm run compile
```

### Deploy to Sepolia
```bash
npm run deploy:sepolia
```

After deployment, you'll get contract addresses saved to `deployment-addresses.json`.

### Update Frontend Configuration
Add contract addresses to your `.env` file:
```env
VITE_PROPERTY_TOKEN_ADDRESS=0x...
VITE_PROPERTY_REGISTRY_ADDRESS=0x...
VITE_ESCROW_ADDRESS=0x...
VITE_PROPERTY_OFFERS_ADDRESS=0x...
```

Or the frontend will automatically read from `deployment-addresses.json`.

## Usage Examples

### Register a Property On-Chain
```javascript
import { registerPropertyOnChain } from './services/contracts'

const result = await registerPropertyOnChain(
  "Beautiful House",
  "123 Main St, City",
  ethers.parseEther("100") // 100 ETH
)
console.log("Property ID:", result.propertyId)
```

### Create an Offer
```javascript
import { createOfferOnChain } from './services/contracts'

const tx = await createOfferOnChain(
  propertyId,
  ethers.parseEther("95"), // Offer amount
  "I'm interested in this property",
  7 * 24 * 60 * 60 // 7 days duration
)
```

### Create Escrow Transaction
```javascript
import { createEscrowETH } from './services/contracts'

const deadline = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
const tx = await createEscrowETH(
  propertyId,
  sellerAddress,
  deadline,
  "100" // 100 ETH
)
```

### Check Token Balance
```javascript
import { getPropertyTokenBalance } from './services/contracts'

const balance = await getPropertyTokenBalance(walletAddress)
console.log("Token balance:", balance)
```

## Contract Interactions

### PropertyToken
- **Transfer tokens**: `transferPropertyTokens(to, amount)`
- **Approve tokens**: `approvePropertyTokens(spender, amount)`
- **Check balance**: `getPropertyTokenBalance(address)`

### PropertyRegistry
- **Register property**: `registerPropertyOnChain(title, location, price)`
- **Get property**: `getPropertyOnChain(propertyId)`
- **List for sale**: `listPropertyForSale(propertyId, price)`
- **Transfer ownership**: `transferPropertyOwnership(propertyId, newOwner, transferType)`

### Escrow
- **Create ETH escrow**: `createEscrowETH(propertyId, seller, deadline, amountInEth)`
- **Create token escrow**: `createEscrowToken(propertyId, seller, amount, deadline)`
- **Complete escrow**: `completeEscrow(transactionId)`
- **Cancel escrow**: `cancelEscrow(transactionId)`
- **Get transaction**: `getEscrowTransaction(transactionId)`

### PropertyOffers
- **Create offer**: `createOfferOnChain(propertyId, amount, message, duration)`
- **Accept offer**: `acceptOfferOnChain(offerId)`
- **Reject offer**: `rejectOfferOnChain(offerId)`
- **Withdraw offer**: `withdrawOfferOnChain(offerId)`
- **Get offer**: `getOfferOnChain(offerId)`

## Security Considerations

1. **Private Keys**: Never commit private keys to version control
2. **Access Control**: Contracts use OpenZeppelin's Ownable for access control
3. **Reentrancy**: Contracts use ReentrancyGuard to prevent reentrancy attacks
4. **Input Validation**: All contracts validate inputs
5. **Deadlines**: Escrow and offers have deadline mechanisms

## Gas Optimization

- Contracts use Solidity 0.8.20 with optimizer enabled (200 runs)
- Events are used for efficient off-chain indexing
- Storage is optimized to minimize gas costs

## Testing

To test contracts locally:
```bash
# Start local Hardhat node
npx hardhat node

# Deploy to local network
npm run deploy:local
```

## Verification

To verify contracts on Etherscan:
```bash
npx hardhat verify --network sepolia CONTRACT_ADDRESS CONSTRUCTOR_ARGS
```

## Support

For issues or questions:
1. Check contract code in `contracts/` directory
2. Review deployment logs
3. Check Etherscan for contract interactions
4. Review event logs for debugging

## Future Enhancements

Potential improvements:
- Multi-signature wallet support
- NFT-based property certificates
- Staking mechanism for tokens
- Governance token features
- Automated property valuation
- Insurance integration



