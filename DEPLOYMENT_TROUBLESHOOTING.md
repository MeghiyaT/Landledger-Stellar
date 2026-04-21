# Deployment Troubleshooting Guide

## HeadersTimeoutError

If you're getting a `HeadersTimeoutError` when deploying, it means the RPC endpoint is timing out. Here are solutions:

### Solution 1: Use a More Reliable RPC Provider

The public RPC endpoints can be slow or rate-limited. Use a dedicated provider:

#### Option A: Infura (Recommended)
1. Sign up at [Infura](https://infura.io/)
2. Create a new project
3. Get your project ID
4. Update `.env`:
```env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
```

#### Option B: Alchemy
1. Sign up at [Alchemy](https://www.alchemy.com/)
2. Create a new app (Sepolia network)
3. Get your API key
4. Update `.env`:
```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
```

#### Option C: QuickNode
1. Sign up at [QuickNode](https://www.quicknode.com/)
2. Create an endpoint for Sepolia
3. Update `.env`:
```env
SEPOLIA_RPC_URL=YOUR_QUICKNODE_ENDPOINT_URL
```

### Solution 2: Increase Timeout

The Hardhat config already includes a 120-second timeout. If you need more:

Edit `hardhat.config.cjs`:
```javascript
sepolia: {
  url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
  accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
  chainId: 11155111,
  timeout: 300000, // 5 minutes
}
```

### Solution 3: Check Network Connection

1. Test your internet connection
2. Try a different network (mobile hotspot, etc.)
3. Check if you're behind a firewall/proxy

### Solution 4: Use Alternative Public RPCs

Try these alternative public RPC endpoints in your `.env`:

```env
# Option 1: Sepolia Gateway
SEPOLIA_RPC_URL=https://sepolia.gateway.tenderly.co

# Option 2: Another public RPC
SEPOLIA_RPC_URL=https://rpc2.sepolia.org

# Option 3: Ankr
SEPOLIA_RPC_URL=https://rpc.ankr.com/eth_sepolia
```

### Solution 5: Deploy in Smaller Batches

If deploying all contracts at once times out, deploy them one at a time:

1. Comment out other deployments in `scripts/deploy.cjs`
2. Deploy one contract at a time
3. Save addresses manually

### Solution 6: Check Your Private Key

Make sure your `.env` file has the correct format:

```env
PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

**Important**: Never commit your `.env` file or share your private key!

### Solution 7: Verify RPC Endpoint

Test if the RPC endpoint is working:

```bash
curl -X POST https://rpc.sepolia.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

If this times out, the RPC is down and you should use a different one.

## Other Common Issues

### Insufficient Balance
```
Error: insufficient funds
```
**Solution**: Get more Sepolia ETH from a faucet (see `GET_SEPOLIA_ETH.md`)

### Nonce Too High
```
Error: nonce too high
```
**Solution**: Reset your account nonce or wait a bit and try again

### Gas Estimation Failed
```
Error: gas required exceeds allowance
```
**Solution**: 
1. Check you have enough ETH
2. Try increasing gas limit in Hardhat config
3. Check if contracts are too large (optimize)

### Contract Verification Failed
```
Error: Contract source code already verified
```
**Solution**: This is just a warning, your contract is already verified

## Recommended Setup

For production deployments, always use:
1. **Infura** or **Alchemy** (most reliable)
2. **Private key** stored securely (use environment variables)
3. **Sufficient Sepolia ETH** (at least 0.1 ETH for multiple deployments)
4. **Stable internet connection**

## Quick Fix Checklist

- [ ] Using Infura/Alchemy RPC (not public endpoint)
- [ ] Private key is correct format (starts with 0x)
- [ ] Have sufficient Sepolia ETH
- [ ] Internet connection is stable
- [ ] `.env` file is in project root
- [ ] Hardhat config timeout is set (120000ms or more)

## Still Having Issues?

1. Check Hardhat version: `npx hardhat --version`
2. Check Node.js version: `node --version` (should be 18.x or 20.x)
3. Try clearing cache: `npx hardhat clean`
4. Recompile: `npm run compile`
5. Check Hardhat logs for more details



