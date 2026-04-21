-- Debug script: Check why transactions aren't showing
-- Run this in your Supabase SQL Editor to diagnose the issue

-- 1. Check if there are any accepted offers
SELECT 
  'Accepted Offers' as check_type,
  COUNT(*) as count,
  STRING_AGG(id::TEXT, ', ') as offer_ids
FROM property_offers
WHERE status = 'accepted';

-- 2. Check if transactions exist for accepted offers
SELECT 
  'Transactions for Accepted Offers' as check_type,
  COUNT(*) as transaction_count,
  STRING_AGG(id::TEXT, ', ') as transaction_ids
FROM transactions
WHERE metadata->>'offer_id' IN (
  SELECT id::TEXT FROM property_offers WHERE status = 'accepted'
);

-- 3. Check all transactions (regardless of offer)
SELECT 
  'All Transactions' as check_type,
  COUNT(*) as total_count,
  COUNT(DISTINCT user_id) as unique_users
FROM transactions;

-- 4. Check transactions by user (replace 'YOUR_USER_ID' with your actual Clerk user ID)
-- First, let's see what user IDs exist in transactions
SELECT 
  'User IDs in Transactions' as check_type,
  user_id,
  COUNT(*) as transaction_count
FROM transactions
GROUP BY user_id
ORDER BY transaction_count DESC;

-- 5. Check if RLS is enabled
SELECT 
  'RLS Status' as check_type,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'transactions';

-- 6. Check RLS policies on transactions
SELECT 
  'RLS Policies' as check_type,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'transactions';

-- 7. Show detailed transaction info
SELECT 
  t.id,
  t.user_id,
  t.transaction_type,
  t.amount,
  t.status,
  t.metadata->>'offer_id' as offer_id,
  t.metadata->>'transaction_flow' as transaction_flow,
  t.created_at,
  po.status as offer_status,
  po.buyer_id,
  po.seller_id
FROM transactions t
LEFT JOIN property_offers po ON po.id::TEXT = t.metadata->>'offer_id'
ORDER BY t.created_at DESC
LIMIT 20;

-- 8. Show all transactions with user IDs (to help identify your user ID)
SELECT 
  'All Transactions with User IDs' as check_type,
  t.id as transaction_id,
  t.user_id,
  t.transaction_type,
  t.amount,
  t.status,
  t.metadata->>'offer_id' as offer_id,
  t.metadata->>'property_title' as property_title,
  t.created_at,
  po.buyer_id as offer_buyer_id,
  po.seller_id as offer_seller_id
FROM transactions t
LEFT JOIN property_offers po ON po.id::TEXT = t.metadata->>'offer_id'
ORDER BY t.created_at DESC;

-- 9. Check transactions for buyer_id from accepted offers
-- This shows transactions that should exist for buyers of accepted offers
SELECT 
  'Transactions for Buyers of Accepted Offers' as check_type,
  po.buyer_id,
  COUNT(DISTINCT t.id) as transaction_count,
  STRING_AGG(t.id::TEXT, ', ') as transaction_ids
FROM property_offers po
LEFT JOIN transactions t ON t.metadata->>'offer_id' = po.id::TEXT AND t.user_id = po.buyer_id
WHERE po.status = 'accepted'
GROUP BY po.buyer_id;

-- 10. Check transactions for seller_id from accepted offers
-- This shows transactions that should exist for sellers of accepted offers
SELECT 
  'Transactions for Sellers of Accepted Offers' as check_type,
  po.seller_id,
  COUNT(DISTINCT t.id) as transaction_count,
  STRING_AGG(t.id::TEXT, ', ') as transaction_ids
FROM property_offers po
LEFT JOIN transactions t ON t.metadata->>'offer_id' = po.id::TEXT AND t.user_id = po.seller_id
WHERE po.status = 'accepted'
GROUP BY po.seller_id;

-- 11. To check YOUR specific transactions, replace 'YOUR_USER_ID' with your Clerk user ID
-- You can find your user ID in step 9 or 10 above (buyer_id or seller_id)
-- Uncomment and run this query with your actual user ID:
-- SELECT 
--   'My Transactions' as check_type,
--   t.id,
--   t.transaction_type,
--   t.amount,
--   t.currency,
--   t.status,
--   t.metadata->>'offer_id' as offer_id,
--   t.metadata->>'property_title' as property_title,
--   t.created_at
-- FROM transactions t
-- WHERE t.user_id = 'YOUR_USER_ID'
-- ORDER BY t.created_at DESC;

SELECT 'Debug check complete! Review the results above.' as message;
SELECT 'Find your user_id in step 9 (if you are a buyer) or step 10 (if you are a seller), then use it in step 11.' as note;
SELECT 'If step 9 or 10 show transaction_count = 0, transactions were not created. Run backfill-transactions-for-accepted-offers-bypass-rls.sql' as note2;



