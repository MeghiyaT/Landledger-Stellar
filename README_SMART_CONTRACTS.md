# Smart Contracts Quick Start

## Overview

This project includes 4 main smart contracts:

1. **PropertyToken (PROP)** - Custom ERC-20 token
2. **PropertyRegistry** - On-chain property ownership registry
3. **Escrow** - Secure transaction escrow service
4. **PropertyOffers** - On-chain offer management

## Quick Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create a `.env` file:
```env
SEPOLIA_RPC_URL=https://rpc.sepolia.org
PRIVATE_KEY=your_private_key_here
```

### 3. Compile Contracts
```bash
npm run compile
```

### 4. Deploy to Sepolia
```bash
npm run deploy:sepolia
```

After deployment, contract addresses will be saved to `deployment-addresses.json`.

### 5. Update Frontend
The frontend will automatically read addresses from `deployment-addresses.json` or you can set them in `.env`:
```env
VITE_PROPERTY_TOKEN_ADDRESS=0x...
VITE_PROPERTY_REGISTRY_ADDRESS=0x...
VITE_ESCROW_ADDRESS=0x...
VITE_PROPERTY_OFFERS_ADDRESS=0x...
```

## Contract Details

### PropertyToken
- **Symbol**: PROP
- **Total Supply**: 1 billion (1,000,000,000)
- **Initial Supply**: 100 million (100,000,000)
- **Features**: Mintable, Burnable, Pausable

### PropertyRegistry
- Register properties on-chain
- Track ownership history
- Transfer ownership
- List properties for sale

### Escrow
- Secure fund holding
- Supports ETH and token payments
- Platform fee: 2.5% (configurable)
- Deadline-based transactions

### PropertyOffers
- Create property offers
- Accept/reject offers
- Withdraw offers
- Track offer history

## Usage in Frontend

```javascript
import { 
  registerPropertyOnChain,
  createOfferOnChain,
  createEscrowETH 
} from './services/contracts'

// Register a property
const result = await registerPropertyOnChain(
  "My Property",
  "123 Main St",
  ethers.parseEther("100")
)

// Create an offer
await createOfferOnChain(
  propertyId,
  ethers.parseEther("95"),
  "I'm interested!",
  7 * 24 * 60 * 60 // 7 days
)

// Create escrow
await createEscrowETH(
  propertyId,
  sellerAddress,
  deadline,
  "100" // 100 ETH
)
```

## Documentation

For detailed documentation, see:
- [SMART_CONTRACTS.md](./SMART_CONTRACTS.md) - Full contract documentation
- [ETHEREUM_INTEGRATION.md](./ETHEREUM_INTEGRATION.md) - Ethereum integration guide

## Security

- Contracts use OpenZeppelin's battle-tested libraries
- ReentrancyGuard protection
- Access control with Ownable
- Input validation on all functions

## Support

For issues:
1. Check contract code in `contracts/` directory
2. Review deployment logs
3. Check Etherscan for contract interactions



