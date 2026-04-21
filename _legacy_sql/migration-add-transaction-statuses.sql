-- Migration: Add in_progress status to transactions table
-- Run this in your Supabase SQL Editor
-- This adds support for the transactional flow statuses

-- Update the status check constraint to include 'in_progress'
ALTER TABLE transactions 
DROP CONSTRAINT IF EXISTS check_transaction_status;

ALTER TABLE transactions 
ADD CONSTRAINT check_transaction_status 
CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'refunded'));

-- Add comment
COMMENT ON COLUMN transactions.status IS 'Transaction status: pending (initial), in_progress (active), completed (successful), failed (unsuccessful), refunded (money returned)';

SELECT 'Transaction status constraint updated successfully!' as message;



