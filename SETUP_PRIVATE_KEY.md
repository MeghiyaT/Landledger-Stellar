# How to Set Up Your Private Key for Deployment

## Getting Your Private Key from MetaMask

### Step 1: Open MetaMask
1. Click the MetaMask extension icon in your browser
2. Make sure you're on the account you want to use for deployment

### Step 2: Export Private Key
1. Click the **three dots (⋮)** next to your account name
2. Select **Account details**
3. Click **Export Private Key**
4. Enter your MetaMask password
5. Click **Confirm**
6. **Copy the private key** (it will look like: `0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef`)

### Step 3: Add to .env File
1. Open your `.env` file in the project root
2. Add the private key:
```env
PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

**Important Notes:**
- The private key should be **64 hexadecimal characters** (32 bytes)
- It can start with `0x` or not - both work
- **NEVER share your private key or commit it to Git!**
- This private key controls your wallet - keep it secure!

## Format Requirements

Your private key should look like one of these formats:

✅ **Correct formats:**
```
PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
PRIVATE_KEY=1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

❌ **Incorrect formats:**
```
PRIVATE_KEY=your_private_key_here  # Placeholder text
PRIVATE_KEY=                        # Empty
PRIVATE_KEY=abc123                  # Too short
PRIVATE_KEY=0xabc                   # Too short
```

## Security Best Practices

1. **Never commit `.env` to Git** - It's already in `.gitignore`
2. **Use a separate account** for deployment (not your main wallet)
3. **Only use testnet accounts** - Never use mainnet private keys
4. **Store securely** - Consider using a password manager
5. **Rotate if exposed** - If you accidentally share it, create a new wallet

## Verifying Your Private Key

To verify your private key is correct:

1. Check the length:
   - With `0x`: Should be 66 characters total
   - Without `0x`: Should be 64 characters total

2. Check the format:
   - Should only contain: `0-9` and `a-f` (or `A-F`)
   - No spaces or special characters

## Example .env File

Here's a complete example `.env` file:

```env
# Sepolia RPC (use Infura or Alchemy for better reliability)
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID

# Private Key (64 hex characters, 32 bytes)
PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef

# Frontend Environment Variables
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_key
VITE_GOOGLE_MAPS_API_KEY=your_maps_key
```

## Troubleshooting

### Error: "private key too short"
- **Cause**: Private key is missing or incomplete
- **Fix**: Make sure you copied the entire private key (64 hex characters)

### Error: "invalid account"
- **Cause**: Private key format is incorrect
- **Fix**: Remove any spaces, ensure it's 64 hex characters

### Error: "insufficient funds"
- **Cause**: Account doesn't have enough Sepolia ETH
- **Fix**: Get Sepolia ETH from a faucet (see `GET_SEPOLIA_ETH.md`)

## Alternative: Using Multiple Accounts

If you want to use multiple accounts, separate them with commas:

```env
PRIVATE_KEY=0xkey1,0xkey2,0xkey3
```

The first account will be used as the deployer.

## Need Help?

If you're still having issues:
1. Double-check the private key format
2. Make sure `.env` is in the project root (same folder as `package.json`)
3. Restart your terminal after updating `.env`
4. Verify the account has Sepolia ETH



