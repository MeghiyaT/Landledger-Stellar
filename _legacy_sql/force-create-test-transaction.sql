-- Force create a test transaction to verify the system works
-- Run this in your Supabase SQL Editor
-- Replace 'YOUR_USER_ID' with your actual Clerk user ID from browser console

-- Step 1: Temporarily disable RLS
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;

-- Step 2: Create a test transaction
-- Replace 'YOUR_USER_ID' with your actual user ID (e.g., 'user_36nTsTBGpiiZrgsY2zIm28SVdhw')
INSERT INTO transactions (
  user_id,
  transaction_type,
  amount,
  currency,
  status,
  description,
  metadata,
  created_at,
  updated_at
) VALUES (
  'YOUR_USER_ID',  -- ⚠️ REPLACE THIS WITH YOUR ACTUAL USER ID
  'purchase',
  1000000.00,
  'INR',
  'pending',
  'Test Transaction - Please delete after verification',
  jsonb_build_object(
    'test_transaction', true,
    'created_by', 'manual_test',
    'note', 'This is a test transaction to verify the system works'
  ),
  NOW(),
  NOW()
)
RETURNING *;

-- Step 3: Re-enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Step 4: Verify the transaction was created
SELECT 
  'Test Transaction Created' as status,
  t.*
FROM transactions t
WHERE t.metadata->>'test_transaction' = 'true'
ORDER BY t.created_at DESC
LIMIT 1;

SELECT 'If you can see the test transaction in Dashboard, the system works!' as message;
SELECT 'If you still can''t see it, RLS is blocking. Run fix-transactions-rls.sql' as note;
SELECT 'After verification, delete the test transaction with:' as cleanup;
SELECT 'DELETE FROM transactions WHERE metadata->>''test_transaction'' = ''true'';' as cleanup_query;


