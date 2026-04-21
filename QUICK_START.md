# Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Start Your Development Server
```bash
npm run dev
```

### Step 2: Connect Your Wallet
1. Open your app (usually `http://localhost:5173`)
2. Click "Connect Wallet" in the header
3. Approve the connection in MetaMask
4. Switch to Sepolia testnet if prompted

### Step 3: Test Your First On-Chain Action

Open browser console (F12) and try:

```javascript
// Import the contract service
import { registerPropertyOnChain, getPropertyOnChain } from './services/contracts'
import { ethers } from 'ethers'

// Register a property on-chain
const result = await registerPropertyOnChain(
  "Test Property",
  "123 Test Street",
  ethers.parseEther("50") // 50 ETH
)

console.log("Property registered! ID:", result.propertyId)

// Get the property back
const property = await getPropertyOnChain(result.propertyId)
console.log("Property details:", property)
```

## 🎯 What You Can Do Now

### Immediate Actions
1. **View Contracts**: Check your contracts on [Sepolia Etherscan](https://sepolia.etherscan.io/)
2. **Test Wallet**: Connect wallet and verify network status
3. **Check Balance**: View your PROP token balance (100M tokens minted to deployer)

### Next Features to Add
1. **Property Registration UI**: Add button to register properties on-chain
2. **Offer Creation**: Allow users to create on-chain offers
3. **Token Display**: Show PROP token balance in user dashboard
4. **Transaction History**: Display blockchain transactions

## 📱 Your Contract Addresses

All contracts are deployed and ready:
- **PropertyToken**: `0x090438d4Eb4CF4c2DD9BE38814a96C9Ff1d165D5`
- **PropertyRegistry**: `0xE6777e72A30e1172dF1BDa042E756C3e672Ace9a`
- **Escrow**: `0x224aD91542182316eF105dCEdC297b4604c39F83`
- **PropertyOffers**: `0xF5b4d2F4B966003747F7Db680dCFf56554B0d71f`

## 🔗 Useful Links

- **Full Guide**: See `NEXT_STEPS.md` for detailed instructions
- **Contract Docs**: See `SMART_CONTRACTS.md`
- **Troubleshooting**: See `DEPLOYMENT_TROUBLESHOOTING.md`

## 💡 Pro Tips

1. **Use Browser Console**: Test contract functions directly in console
2. **Check Etherscan**: Monitor your contract interactions
3. **Start Small**: Test one feature at a time
4. **Read Events**: Contracts emit events you can listen to

Ready to build! 🎉



