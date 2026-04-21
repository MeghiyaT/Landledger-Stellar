-- Migration: Create transactions table
-- Run this in your Supabase SQL Editor

-- Create transactions table for transaction history
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id TEXT NOT NULL, -- Clerk user ID
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL, -- 'purchase', 'rental', 'sale', 'rental_payment', 'fee'
  amount DECIMAL(12, 2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed', 'refunded'
  description TEXT,
  blockchain_tx_hash TEXT, -- For blockchain transactions
  metadata JSONB, -- Additional transaction data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_property_id ON transactions(property_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

-- Enable Row Level Security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own transactions
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (user_id = public.clerk_user_id());

-- Policy: Users can create their own transactions
CREATE POLICY "Users can create own transactions" ON transactions
  FOR INSERT WITH CHECK (
    user_id = public.clerk_user_id()
    OR current_setting('request.jwt.claims', true) IS NOT NULL
  );

-- Policy: Users can update their own transactions
CREATE POLICY "Users can update own transactions" ON transactions
  FOR UPDATE USING (user_id = public.clerk_user_id())
  WITH CHECK (user_id = public.clerk_user_id());

-- Add comment
COMMENT ON TABLE transactions IS 'Transaction history for users including purchases, rentals, and fees';

SELECT 'Transactions table created successfully!' as message;






