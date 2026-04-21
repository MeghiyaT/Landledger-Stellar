# Token-Based Transaction Flow

## Overview

The transaction flow has been updated to use **PROP tokens** instead of ETH for all property transactions. This provides a more consistent and controlled payment mechanism.

## How It Works

### 1. Offer Acceptance Flow

When a seller accepts an offer:

1. **Check Wallets**: System verifies both buyer and seller have connected wallets
2. **Create Token Escrow**: 
   - Buyer's tokens are locked in escrow contract
   - Requires buyer to approve token spending first
   - Creates secure escrow with deadline
3. **Create Transactions**: 
   - Buyer transaction: Shows amount in PROP tokens
   - Seller transaction: Shows amount in PROP tokens
   - Both marked as "in_progress" when escrow is active

### 2. Token Conversion

- **Conversion Rate**: 1 INR = 1 PROP token (configurable in `src/utils/tokenConversion.js`)
- **Offer Amount**: Offer amount in INR is converted to tokens
- **Display**: All transaction amounts show in PROP tokens when escrow is used

### 3. Escrow Process

#### Creating Escrow:
1. Buyer approves Escrow contract to spend tokens
2. Buyer's tokens are transferred to Escrow contract
3. Escrow holds tokens until completion or deadline
4. Transaction ID stored in blockchain and Supabase

#### Completing Escrow:
1. Seller marks transaction as "completed"
2. Escrow contract releases tokens to seller
3. Property ownership transferred on blockchain (if on-chain)
4. Transaction status updated to "completed"

#### Canceling Escrow:
1. Buyer can cancel before deadline
2. Tokens returned to buyer
3. Transaction marked as "failed"

## Token Requirements

### For Buyers:
- Must have PROP tokens in wallet
- Must approve Escrow contract to spend tokens
- Tokens are locked in escrow until completion

### For Sellers:
- Must have connected wallet to receive tokens
- Receives tokens when transaction completes

## Transaction States

- **pending**: Traditional transaction (no escrow)
- **in_progress**: Token escrow active, waiting for completion
- **completed**: Escrow completed, tokens transferred
- **failed**: Escrow cancelled or failed

## Currency Display

- **PROP**: Token-based escrow transaction
- **INR**: Traditional transaction (no escrow)
- **ETH**: Legacy (should not appear in new transactions)

## Configuration

### Token Conversion Rate
Edit `src/utils/tokenConversion.js`:
```javascript
const INR_TO_TOKEN_RATE = 1 // Change this to adjust conversion
```

### Escrow Deadline
Default: 30 days
Can be adjusted in `src/services/escrow.js`:
```javascript
deadlineDays = 30 // Change default deadline
```

## Benefits

1. **Consistent Currency**: All transactions use PROP tokens
2. **Secure Escrow**: Tokens locked until transaction completes
3. **Automatic Approval**: System handles token approval flow
4. **Blockchain Verification**: All escrow transactions on-chain
5. **Graceful Fallback**: Falls back to traditional transactions if wallets not connected

## User Experience

### For Buyers:
1. Make offer (in INR)
2. When offer accepted, approve token spending (one-time per escrow)
3. Tokens locked in escrow
4. Wait for seller to complete transaction
5. Tokens released to seller on completion

### For Sellers:
1. Accept offer
2. System creates token escrow automatically
3. Wait for buyer to approve tokens
4. Mark transaction as completed when ready
5. Receive tokens automatically

## Technical Details

### Files Modified:
- `src/services/escrow.js` - Updated to use tokens
- `src/services/offers.js` - Creates token escrow on offer acceptance
- `src/utils/tokenConversion.js` - New utility for conversions
- `src/pages/Dashboard.jsx` - Updated to display PROP tokens

### Smart Contracts Used:
- **PropertyToken**: ERC-20 token (PROP)
- **Escrow**: Holds tokens until transaction completes

## Migration Notes

Existing transactions with ETH currency will continue to work. New transactions will use PROP tokens by default when wallets are connected.



