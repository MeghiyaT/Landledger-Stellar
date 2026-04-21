-- Quick script: Check transactions for YOUR user ID
-- Run this in your Supabase SQL Editor
-- 
-- INSTRUCTIONS:
-- 1. Open your browser console on the Dashboard page
-- 2. Look for: "User ID used for query: user_xxxxx" in the console logs
-- 3. Replace 'YOUR_USER_ID_HERE' below with that user ID
-- 4. Run this script

-- Replace 'YOUR_USER_ID_HERE' with your actual Clerk user ID
-- Example: WHERE t.user_id = 'user_36nTsTBGpiiZrgsY2zIm28SVdhw'

-- Check if transactions exist for your user ID
SELECT 
  'My Transactions' as check_type,
  t.id,
  t.user_id,
  t.transaction_type,
  t.amount,
  t.currency,
  t.status,
  t.description,
  t.metadata->>'offer_id' as offer_id,
  t.metadata->>'property_title' as property_title,
  t.metadata->>'property_location' as property_location,
  t.metadata->>'transaction_flow' as transaction_flow,
  t.created_at,
  t.updated_at
FROM transactions t
WHERE t.user_id = 'YOUR_USER_ID_HERE'  -- ⚠️ REPLACE THIS WITH YOUR ACTUAL USER ID
ORDER BY t.created_at DESC;

-- Count your transactions
SELECT 
  'Transaction Count' as check_type,
  COUNT(*) as total_transactions,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
  COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_count,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count
FROM transactions
WHERE user_id = 'YOUR_USER_ID_HERE';  -- ⚠️ REPLACE THIS WITH YOUR ACTUAL USER ID

-- Check if RLS is blocking your view
-- This query bypasses RLS (when run in SQL Editor) to see if transactions exist
SELECT 
  'All Transactions (Bypassing RLS)' as check_type,
  COUNT(*) as total_in_database,
  COUNT(CASE WHEN user_id = 'YOUR_USER_ID_HERE' THEN 1 END) as my_transactions_in_db
FROM transactions;  -- ⚠️ REPLACE YOUR_USER_ID_HERE WITH YOUR ACTUAL USER ID

SELECT 'If you see transactions in the first query but not in Dashboard, RLS is blocking. Run fix-transactions-rls.sql' as note;
SELECT 'If you see 0 transactions in all queries, run backfill-transactions-for-accepted-offers-bypass-rls.sql' as note2;



