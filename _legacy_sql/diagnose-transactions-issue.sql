-- Comprehensive diagnostic script for transaction visibility issues
-- Run this in your Supabase SQL Editor
-- This will help identify why transactions aren't showing in Dashboard

-- ============================================
-- STEP 1: Check if accepted offers exist
-- ============================================
SELECT 
  'STEP 1: Accepted Offers' as step,
  COUNT(*) as count,
  STRING_AGG(id::TEXT, ', ') as offer_ids,
  STRING_AGG(buyer_id, ', ') as buyer_ids,
  STRING_AGG(seller_id, ', ') as seller_ids
FROM property_offers
WHERE status = 'accepted';

-- ============================================
-- STEP 2: Check if transactions exist in database
-- ============================================
SELECT 
  'STEP 2: All Transactions in Database' as step,
  COUNT(*) as total_transactions,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(CASE WHEN metadata->>'transaction_flow' = 'offer_accepted_backfill' THEN 1 END) as backfilled_count
FROM transactions;

-- ============================================
-- STEP 3: Check transactions linked to accepted offers
-- ============================================
SELECT 
  'STEP 3: Transactions for Accepted Offers' as step,
  po.id as offer_id,
  po.buyer_id,
  po.seller_id,
  po.status as offer_status,
  COUNT(DISTINCT t.id) as transaction_count,
  STRING_AGG(DISTINCT t.id::TEXT, ', ') as transaction_ids,
  STRING_AGG(DISTINCT t.user_id, ', ') as transaction_user_ids
FROM property_offers po
LEFT JOIN transactions t ON t.metadata->>'offer_id' = po.id::TEXT
WHERE po.status = 'accepted'
GROUP BY po.id, po.buyer_id, po.seller_id, po.status;

-- ============================================
-- STEP 4: Show all transactions with details
-- ============================================
SELECT 
  'STEP 4: All Transaction Details' as step,
  t.id,
  t.user_id,
  t.transaction_type,
  t.amount,
  t.status,
  t.metadata->>'offer_id' as offer_id,
  t.metadata->>'transaction_flow' as transaction_flow,
  t.created_at,
  po.buyer_id as offer_buyer_id,
  po.seller_id as offer_seller_id,
  po.status as offer_status
FROM transactions t
LEFT JOIN property_offers po ON po.id::TEXT = t.metadata->>'offer_id'
ORDER BY t.created_at DESC;

-- ============================================
-- STEP 5: Check RLS status
-- ============================================
SELECT 
  'STEP 5: RLS Status' as step,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'transactions';

-- ============================================
-- STEP 6: Check RLS policies
-- ============================================
SELECT 
  'STEP 6: RLS Policies' as step,
  policyname,
  permissive,
  roles,
  cmd as command_type,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'transactions'
ORDER BY policyname;

-- ============================================
-- STEP 7: Test query that simulates what the app does
-- ============================================
-- Replace 'YOUR_USER_ID' with your actual Clerk user ID from browser console
-- This simulates the exact query the Dashboard makes
SELECT 
  'STEP 7: Test Query (Replace YOUR_USER_ID)' as step,
  'Run this query with your actual user_id from browser console' as instruction;

-- Uncomment and replace YOUR_USER_ID with your actual user ID:
-- SELECT 
--   t.*
-- FROM transactions t
-- WHERE t.user_id = 'YOUR_USER_ID'
-- ORDER BY t.created_at DESC
-- LIMIT 50;

-- ============================================
-- STEP 8: Check if transactions exist but user_id doesn't match
-- ============================================
SELECT 
  'STEP 8: User ID Mismatch Check' as step,
  'If transactions exist but have different user_ids, they won''t show' as note,
  COUNT(DISTINCT t.user_id) as unique_user_ids_in_transactions,
  STRING_AGG(DISTINCT t.user_id, ', ') as all_user_ids
FROM transactions t;

-- ============================================
-- STEP 9: Manual backfill verification
-- ============================================
-- This shows which accepted offers are missing transactions
SELECT 
  'STEP 9: Missing Transactions' as step,
  po.id as offer_id,
  po.buyer_id,
  po.seller_id,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM transactions WHERE metadata->>'offer_id' = po.id::TEXT AND user_id = po.buyer_id) 
    THEN 'Missing buyer transaction'
    ELSE 'Buyer transaction exists'
  END as buyer_tx_status,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM transactions WHERE metadata->>'offer_id' = po.id::TEXT AND user_id = po.seller_id) 
    THEN 'Missing seller transaction'
    ELSE 'Seller transaction exists'
  END as seller_tx_status
FROM property_offers po
WHERE po.status = 'accepted';

SELECT '═══════════════════════════════════════════════════════════' as separator;
SELECT 'Diagnostic complete! Review all steps above.' as message;
SELECT 'Key things to check:' as checklist;
SELECT '  1. Step 1: Do accepted offers exist?' as item1;
SELECT '  2. Step 2: Do transactions exist in database?' as item2;
SELECT '  3. Step 3: Are transactions linked to offers?' as item3;
SELECT '  4. Step 6: Are RLS policies correct?' as item4;
SELECT '  5. Step 7: Test with your actual user_id' as item5;
SELECT '  6. Step 9: Are any transactions missing?' as item6;


