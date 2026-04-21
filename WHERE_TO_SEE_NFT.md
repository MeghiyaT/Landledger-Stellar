# Where to See Your Property NFT

After registering a property, you can view the NFT in several places:

## 1. Property Details Page (Main Location)

**Location**: When viewing any property listing, scroll down to see the NFT information card.

**What you'll see:**
- ✅ NFT Token ID
- ✅ NFT Contract Address  
- ✅ Token URI (IPFS link to metadata)
- ✅ Mint Transaction Hash (link to Etherscan)
- ✅ Transfer Transaction Hash (if property was sold)
- ✅ Quick action buttons to view on Etherscan and IPFS

**How to access:**
1. Go to any property listing
2. Click on the property to view details
3. Scroll down past property details
4. Look for the **"NFT Certificate"** card

## 2. Dashboard - My Listings

**Location**: Dashboard → My Listings tab

**What you'll see:**
- Properties you've listed
- Blockchain badge if property is on-chain
- Click on property to see full details including NFT

**How to access:**
1. Go to Dashboard
2. Click "My Listings" tab
3. Click on any property
4. View NFT information in property details

## 3. Direct Database Query

You can check if your property has an NFT by querying the database:

```sql
SELECT 
  id,
  title,
  nft_token_id,
  nft_contract_address,
  nft_token_uri,
  nft_mint_tx_hash
FROM properties
WHERE nft_token_id IS NOT NULL;
```

## 4. Etherscan (Blockchain Explorer)

**View NFT on Etherscan:**
1. Get your NFT contract address from property details
2. Get your token ID
3. Visit: `https://sepolia.etherscan.io/token/{CONTRACT_ADDRESS}?a={TOKEN_ID}`

**View Mint Transaction:**
1. Get mint transaction hash from property details
2. Visit: `https://sepolia.etherscan.io/tx/{MINT_TX_HASH}`

## 5. IPFS Metadata

**View Property Metadata on IPFS:**
1. Get token URI from property details (starts with `ipfs://`)
2. Remove `ipfs://` prefix
3. Visit: `https://gateway.pinata.cloud/ipfs/{CID}`
   - Or: `https://ipfs.io/ipfs/{CID}`
   - Or: `https://cloudflare-ipfs.com/ipfs/{CID}`

## What If I Don't See NFT Information?

### Check if NFT was minted:
1. **Check Database**: Query your properties table for `nft_token_id`
2. **Check Console**: Look for "NFT minted successfully!" message when listing property
3. **Check Transaction**: Look for mint transaction in your wallet history

### Common Issues:

**NFT not minted:**
- PropertyNFT contract not deployed
- Contract address not in `deployment-addresses.json`
- Wallet not connected during property registration
- NFT minting failed (check console for errors)

**NFT minted but not showing:**
- Property data not refreshed (try refreshing page)
- NFT columns missing from database (run `migration-add-nft-columns.sql`)
- Property query not including NFT fields

## Quick Checklist

✅ Property registered on blockchain?  
✅ NFT contract deployed?  
✅ NFT minted successfully?  
✅ NFT data saved to database?  
✅ Property details page showing NFT card?

## Next Steps

Once you can see your NFT:
- ✅ Share Etherscan link to prove ownership
- ✅ View metadata on IPFS
- ✅ Transfer NFT when selling property
- ✅ Verify NFT ownership on blockchain

## Need Help?

If you can't see your NFT:
1. Check browser console for errors
2. Verify NFT contract is deployed
3. Check database for NFT fields
4. Ensure property was registered with wallet connected

