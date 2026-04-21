# Transactional Flow Documentation

## Overview
This document describes the complete transactional flow for property sales and rentals in the Meghiya platform.

## Flow Diagram

```
1. Buyer makes offer → 2. Seller accepts offer → 3. Transaction created → 4. Transaction in progress → 5. Transaction completed
```

## Components

### 1. Offer Creation
- **Location**: PropertyDetails page
- **Action**: Buyer clicks "Make an Offer" or "Rent This Property"
- **Result**: Offer created with status `pending`

### 2. Offer Acceptance
- **Location**: Dashboard → Property Offers tab
- **Action**: Seller clicks "Accept Offer"
- **Result**: 
  - Offer status updated to `accepted`
  - **Two transactions created automatically:**
    - Buyer transaction: `transaction_type: 'purchase'` or `'rental'`, `status: 'pending'`
    - Seller transaction: `transaction_type: 'sale'` or `'rental'`, `status: 'pending'`
  - Both parties notified

### 3. Transaction Management
- **Location**: Dashboard → Transactions tab
- **Features**:
  - View all transactions (buyer and seller perspectives)
  - Filter by status (All, Pending, In Progress, Completed, Failed)
  - Update transaction status
  - View transaction details (property, amount, dates, metadata)

### 4. Transaction Status Flow

#### Status Progression:
1. **Pending** (Initial state)
   - Transaction just created
   - Actions: Mark as In Progress, Mark as Failed

2. **In Progress** (Active transaction)
   - Payment/documentation in process
   - Actions: Mark as Completed, Mark as Failed

3. **Completed** (Successful)
   - Transaction finished successfully
   - No further actions

4. **Failed** (Unsuccessful)
   - Transaction did not complete
   - No further actions

## Database Schema

### Transactions Table
- `id`: UUID (Primary Key)
- `user_id`: TEXT (Clerk user ID)
- `property_id`: UUID (Foreign key to properties)
- `transaction_type`: TEXT ('purchase', 'rental', 'sale', 'rental_payment', 'fee')
- `amount`: DECIMAL(12, 2)
- `currency`: TEXT (default 'INR')
- `status`: TEXT ('pending', 'in_progress', 'completed', 'failed', 'refunded')
- `description`: TEXT
- `blockchain_tx_hash`: TEXT (optional, for blockchain transactions)
- `metadata`: JSONB (stores offer_id, property details, etc.)
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

## API Functions

### Offers Service (`src/services/offers.js`)
- `acceptOfferAndCreateTransaction(offerId, userId)`: Accepts offer and creates transactions for both parties

### Transactions Service (`src/services/transactions.js`)
- `getTransactions(userId, filters)`: Get user's transactions with optional filters
- `createTransaction(transactionData)`: Create a new transaction
- `updateTransactionStatus(transactionId, status, userId)`: Update transaction status (with user verification)

## User Experience

### For Buyers:
1. Browse properties
2. Make an offer
3. Wait for seller acceptance
4. Once accepted, transaction appears in "Transactions" tab
5. Track transaction progress
6. Mark as completed when property transfer is done

### For Sellers:
1. Receive offers on properties
2. Accept/reject offers
3. When accepting, transaction automatically created
4. Manage transaction in "Transactions" tab
5. Update status as transaction progresses
6. Mark as completed when payment received

## Security Features
- Users can only view their own transactions
- Users can only update their own transactions
- Transaction creation requires proper authentication
- Offer acceptance verified before transaction creation

## Migration Files
1. `add-transactions-table.sql`: Creates transactions table
2. `migration-add-transaction-statuses.sql`: Adds `in_progress` status support

## Future Enhancements
- Payment gateway integration
- Document exchange system
- Escrow services
- Automated status updates based on payment confirmation
- Transaction dispute resolution
- Email notifications for status changes



