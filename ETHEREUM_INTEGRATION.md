# Ethereum Sepolia Testnet Integration

This project has been converted to work with Ethereum Sepolia testnet for blockchain-based transactions.

## Features

### 1. Wallet Integration
- **MetaMask Support**: Connect your MetaMask wallet to the application
- **Network Validation**: Automatically validates that you're connected to Sepolia testnet
- **Network Switching**: One-click switch to Sepolia if on wrong network
- **Balance Display**: View your ETH balance on Sepolia testnet

### 2. Blockchain Transactions
- **ETH Payments**: Send ETH payments directly on-chain
- **Transaction Tracking**: All blockchain transactions are tracked with transaction hashes
- **Transaction Verification**: Verify transactions on Sepolia Etherscan
- **Automatic Status Updates**: Transaction status updates automatically based on blockchain confirmation

### 3. Network Management
- **Sepolia Enforcement**: Application requires Sepolia testnet for all blockchain operations
- **Network Status Indicator**: Visual indicator showing current network status
- **Automatic Network Switching**: Prompts to switch network when needed

## Setup

### 1. Install MetaMask
If you don't have MetaMask installed:
1. Visit [MetaMask.io](https://metamask.io/)
2. Install the browser extension
3. Create a new wallet or import an existing one

### 2. Add Sepolia Testnet to MetaMask
The application will automatically prompt you to add Sepolia if it's not already in your MetaMask. Alternatively, you can add it manually:

**Network Details:**
- **Network Name**: Sepolia
- **RPC URL**: `https://rpc.sepolia.org` (or use your custom RPC from environment variables)
- **Chain ID**: `11155111`
- **Currency Symbol**: `ETH`
- **Block Explorer**: `https://sepolia.etherscan.io`

### 3. Get Sepolia ETH
You'll need Sepolia testnet ETH to make transactions. Here are free faucets that **don't require existing ETH**:

#### ✅ No Mainnet ETH Required (Recommended):
1. **Google Ethereum Sepolia Faucet** ⭐ Easiest
   - **URL**: [faucet.quicknode.com/ethereum/sepolia](https://faucet.quicknode.com/ethereum/sepolia)
   - **Amount**: 0.03 ETH daily
   - **Requirement**: Just sign in with Google account
   - **No mainnet ETH needed!**

2. **GHOST Faucet**
   - **URL**: [ghostfaucet.com](https://ghostfaucet.com/)
   - **Amount**: 0.01 ETH daily
   - **Requirement**: Just complete CAPTCHA
   - **No mainnet ETH needed!**

3. **Ethereum Sepolia Faucet**
   - **URL**: [sepoliafaucet.com](https://sepoliafaucet.com/)
   - **Amount**: 0.001 ETH daily
   - **Requirement**: Connect wallet + CAPTCHA
   - **No mainnet ETH needed!**

#### ⚠️ Requires Mainnet ETH (0.001 ETH minimum):
- **Alchemy Sepolia Faucet**: [sepoliafaucet.com](https://sepoliafaucet.com/) - Up to 0.5 ETH daily (requires Alchemy account + 0.001 mainnet ETH)
- **QuickNode Sepolia Faucet**: [faucet.quicknode.com](https://faucet.quicknode.com/) - 0.05 ETH every 12 hours (requires 0.001 mainnet ETH)

**💡 Tip**: Start with the Google faucet - it's the easiest and doesn't require any existing ETH!

### 4. Environment Configuration
Add to your `.env` file (optional):
```env
# Optional: Custom Sepolia RPC URL
VITE_SEPOLIA_RPC_URL=https://rpc.sepolia.org
# Or use Infura/Alchemy for better reliability:
# VITE_SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
# VITE_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
```

## Usage

### Connecting Your Wallet
1. Click "Connect Wallet" in the header
2. Approve the connection in MetaMask
3. If not on Sepolia, you'll be prompted to switch networks
4. Your wallet address and balance will be displayed

### Making Payments
When making a property purchase or payment:
1. Ensure you're connected to Sepolia testnet
2. Confirm you have sufficient ETH balance
3. Approve the transaction in MetaMask
4. Wait for transaction confirmation (usually 1-2 blocks on Sepolia)
5. Transaction status will update automatically

### Viewing Transactions
- All blockchain transactions are stored with their transaction hash
- Click on a transaction hash to view it on [Sepolia Etherscan](https://sepolia.etherscan.io)
- Transaction status updates automatically based on blockchain confirmation

## Technical Details

### Web3 Library
- **ethers.js v6**: Used for all Ethereum interactions
- **BrowserProvider**: Connects to MetaMask
- **Transaction Management**: Handles sending, waiting, and verifying transactions

### Network Configuration
- **Chain ID**: `11155111` (Sepolia)
- **Network Name**: Sepolia
- **Currency**: ETH (Ether)
- **Block Explorer**: Sepolia Etherscan

### Transaction Flow
1. User initiates transaction
2. Transaction sent to Sepolia network via MetaMask
3. Transaction hash stored in database
4. Application waits for confirmation
5. Status updated based on receipt

## Security Notes

⚠️ **Important**: This is a testnet application. Do NOT use mainnet ETH or real funds.

- All transactions are on Sepolia testnet
- Testnet ETH has no real value
- Always verify you're on Sepolia before making transactions
- Never share your private keys or seed phrases

## Troubleshooting

### "Please switch to Sepolia testnet"
- Click the "Switch to Sepolia" button in the network status indicator
- Or manually switch networks in MetaMask

### Transaction Failed
- Check you have sufficient ETH balance
- Verify you're on Sepolia testnet
- Check transaction on Etherscan for details

### Can't Connect Wallet
- Ensure MetaMask is installed and unlocked
- Check that MetaMask is enabled for this site
- Try refreshing the page

### Balance Not Updating
- Wait a few seconds for the balance to load
- Check that you're on Sepolia testnet
- Refresh the page if needed

## Future Enhancements

Potential future additions:
- Smart contract integration for property ownership
- Escrow smart contracts for secure transactions
- NFT-based property certificates
- Multi-signature wallet support
- Gas price optimization

## Resources

- [Sepolia Testnet Explorer](https://sepolia.etherscan.io)
- [MetaMask Documentation](https://docs.metamask.io/)
- [ethers.js Documentation](https://docs.ethers.org/)

### Free Sepolia Faucets (No ETH Required):
- [Google Sepolia Faucet](https://faucet.quicknode.com/ethereum/sepolia) - 0.03 ETH daily (Google sign-in)
- [GHOST Faucet](https://ghostfaucet.com/) - 0.01 ETH daily (CAPTCHA only)
- [Ethereum Sepolia Faucet](https://sepoliafaucet.com/) - 0.001 ETH daily (Wallet + CAPTCHA)

