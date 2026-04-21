# Hybrid Blockchain Integration

## How It Works

Your platform now supports **hybrid mode** - properties can be saved to both Supabase (database) AND the blockchain (optional).

### Current Behavior

**Without Blockchain (Default):**
- User fills out the form and submits
- Property is saved **only to Supabase** (database)
- Works exactly as before - no blockchain involved

**With Blockchain (Optional):**
- User checks "Register on Blockchain" checkbox
- User must have wallet connected and be on Sepolia
- Property is saved to **both Supabase AND blockchain**
- Blockchain property ID and transaction hash are stored in Supabase

## What I Added

### 1. Checkbox in Sell Property Form
- Appears if MetaMask is installed
- Shows status (wallet connected, network correct, etc.)
- Optional - users can choose to register on blockchain or not

### 2. Dual Save Process
When user submits with blockchain enabled:
1. **First**: Register property on blockchain (PropertyRegistry contract)
2. **Then**: Save to Supabase with blockchain data included
3. If blockchain fails, property still saves to Supabase (graceful degradation)

### 3. Data Stored
In Supabase, properties now can have:
- `blockchain_property_id` - The on-chain property ID
- `blockchain_tx_hash` - Transaction hash for verification

## Database Migration Needed

You'll need to add these columns to your `properties` table:

```sql
-- Add blockchain columns to properties table
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS blockchain_property_id TEXT,
ADD COLUMN IF NOT EXISTS blockchain_tx_hash TEXT;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_properties_blockchain_id ON properties(blockchain_property_id);
```

## User Experience

### Scenario 1: User Without Wallet
- Sees normal form (no blockchain option)
- Property saves to Supabase only
- Works exactly as before

### Scenario 2: User With Wallet (Not Connected)
- Sees blockchain checkbox
- Can check it, but will be prompted to connect wallet
- If they don't connect, property saves to Supabase only

### Scenario 3: User With Wallet (Connected, Wrong Network)
- Sees blockchain checkbox
- Can check it, but will be prompted to switch to Sepolia
- If they don't switch, property saves to Supabase only

### Scenario 4: User With Wallet (Connected, Sepolia)
- Sees blockchain checkbox
- Can check it and register on blockchain
- Property saves to both Supabase and blockchain
- Gets blockchain property ID and transaction hash

## Benefits

1. **Backward Compatible**: Existing users without wallets work normally
2. **Optional**: Users choose whether to use blockchain
3. **Graceful Degradation**: If blockchain fails, Supabase save still works
4. **Hybrid Data**: Properties can exist in both systems
5. **Verification**: Blockchain transaction hash proves registration

## Future Enhancements

You could add:
1. **Sync Function**: Register existing Supabase properties to blockchain
2. **Verification Badge**: Show "Verified on Blockchain" badge for on-chain properties
3. **Dual Ownership**: Track ownership in both systems
4. **Migration Tool**: Bulk register existing properties

## Testing

1. **Test without wallet**: Submit form normally - should work
2. **Test with wallet (not connected)**: Check blockchain box - should prompt for wallet
3. **Test with wallet (wrong network)**: Check blockchain box - should prompt for network switch
4. **Test with wallet (Sepolia)**: Check blockchain box - should register on both

## Code Changes Made

1. **SellProperty.jsx**:
   - Added `useWallet` hook
   - Added `registerOnBlockchain` state
   - Added blockchain checkbox UI
   - Modified `handleSubmit` to call blockchain registration
   - Stores blockchain data in Supabase

2. **No changes needed to**:
   - Other pages (they work as before)
   - Database schema (migration needed, but code handles missing columns)

## Important Notes

- Blockchain registration is **optional** - not required
- If blockchain registration fails, Supabase save still happens
- Users can always use the platform without blockchain
- Blockchain adds permanent, verifiable ownership records
- Gas fees apply for blockchain transactions (testnet ETH)



