# IPFS Integration Setup Guide

This guide will help you set up IPFS (InterPlanetary File System) integration for decentralized storage of property images and metadata.

## What is IPFS?

IPFS is a distributed file storage system that stores files across a peer-to-peer network. Files are identified by Content Identifiers (CIDs) that are unique and permanent. This makes IPFS perfect for storing property data in a decentralized, immutable way.

## Benefits

- **Decentralized**: Files are stored across multiple nodes, not on a single server
- **Immutable**: Once uploaded, files cannot be changed (content-addressed)
- **Permanent**: Files remain accessible as long as at least one node has them
- **Censorship-resistant**: No single entity controls the data

## Setup Steps

### Step 1: Create a Pinata Account

1. Go to [https://app.pinata.cloud/](https://app.pinata.cloud/)
2. Sign up for a free account
3. The free tier includes:
   - 1GB storage
   - 100 requests/day
   - Public gateway access

### Step 2: Generate API Key (JWT)

1. In Pinata Dashboard, go to **API Keys**
2. Click **New Key**
3. Give it a name (e.g., "Property Platform")
4. Select permissions:
   - ✅ **pinFileToIPFS** (required)
   - ✅ **pinJSONToIPFS** (required)
   - ✅ **unpin** (optional, for deleting files)
5. Click **Create**
6. **Copy the JWT token** (you'll only see it once!)

### Step 3: Add JWT to Environment Variables

1. Open your `.env` file
2. Add the following line:
   ```
   VITE_PINATA_JWT=your_jwt_token_here
   ```
3. Replace `your_jwt_token_here` with the JWT you copied
4. Save the file
5. **Restart your development server**

### Step 4: Run Database Migration

1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Run the migration file: `migration-add-ipfs-columns.sql`
4. This adds columns to store IPFS CIDs:
   - `ipfs_metadata_cid` - CID for property metadata JSON
   - `ipfs_metadata_url` - Gateway URL for easy access
   - `ipfs_image_cids` - Array of CIDs for property images

### Step 5: Test IPFS Upload

1. Go to the **Sell Property** page
2. Fill in property details
3. Upload some images
4. Check the **"Store on IPFS (Decentralized Storage)"** checkbox
5. Submit the form
6. You should see "Uploaded to IPFS!" in the success message

## How It Works

### When IPFS is Enabled:

1. **Property Metadata**: All property details (title, description, features, etc.) are stored as a JSON file on IPFS
2. **Image URLs**: Image URLs (from Supabase Storage) are included in the metadata
3. **CID Storage**: The IPFS Content Identifier (CID) is stored in your database
4. **Gateway Access**: You can access the data via any IPFS gateway using the CID

### IPFS Gateway URLs

Files stored on IPFS can be accessed via multiple gateways:

- **Pinata Gateway**: `https://gateway.pinata.cloud/ipfs/{CID}`
- **IPFS.io**: `https://ipfs.io/ipfs/{CID}`
- **Cloudflare**: `https://cloudflare-ipfs.com/ipfs/{CID}`
- **Dweb**: `https://dweb.link/ipfs/{CID}`

The application automatically uses the best available gateway.

## Viewing IPFS Data

### In Property Details

Properties with IPFS data will show:
- IPFS metadata CID
- Link to view metadata on IPFS gateway
- Individual image CIDs (if uploaded separately)

### Direct Access

You can access IPFS data directly using the CID:

1. Get the CID from your database (`ipfs_metadata_cid` column)
2. Visit: `https://gateway.pinata.cloud/ipfs/{CID}`
3. Or use any other IPFS gateway

## Troubleshooting

### "Pinata JWT not configured" Warning

- Make sure `VITE_PINATA_JWT` is in your `.env` file
- Restart your dev server after adding it
- Check that the JWT token is correct (no extra spaces)

### "Failed to upload to IPFS" Error

- Check your Pinata account limits (free tier: 100 requests/day)
- Verify your JWT token is valid
- Check browser console for detailed error messages
- Ensure you have internet connection

### Files Not Accessible

- IPFS files may take a few seconds to propagate across the network
- Try different gateways if one doesn't work
- Check that the CID is correct in your database

## Advanced Usage

### Custom Gateway

You can use a custom IPFS gateway by setting:
```
VITE_PINATA_GATEWAY=your-custom-gateway.com
```

### Uploading Images Directly to IPFS

Currently, images are uploaded to Supabase Storage first, then metadata (including image URLs) is stored on IPFS. To upload images directly to IPFS:

1. Modify `handleImageUpload` in `SellProperty.jsx`
2. Upload files to IPFS before Supabase Storage
3. Store IPFS CIDs instead of Supabase URLs

## Security Notes

- **JWT Token**: Keep your Pinata JWT secret! Never commit it to Git
- **Public Data**: Files uploaded to IPFS are publicly accessible via CID
- **Pinning**: Pinata "pins" your files, keeping them accessible even if you stop using the service (within free tier limits)

## Next Steps

- View IPFS data in property details pages
- Add IPFS badges to property cards
- Create IPFS verification tools
- Integrate IPFS CIDs into smart contracts

## Resources

- [Pinata Documentation](https://docs.pinata.cloud/)
- [IPFS Documentation](https://docs.ipfs.tech/)
- [IPFS Gateway List](https://ipfs.github.io/public-gateway-checker/)



