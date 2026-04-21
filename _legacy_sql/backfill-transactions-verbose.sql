-- Verbose backfill script with detailed output
-- Run this in your Supabase SQL Editor
-- This version provides detailed feedback about what's happening

-- Step 1: Check what we're working with
SELECT 
  'Pre-Backfill Check' as phase,
  COUNT(*) as accepted_offers_count
FROM property_offers
WHERE status = 'accepted';

SELECT 
  'Pre-Backfill Transactions' as phase,
  COUNT(*) as existing_transactions_count
FROM transactions;

-- Step 2: Temporarily disable RLS
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;

-- Step 3: Backfill with detailed logging
DO $$
DECLARE
  offer_record RECORD;
  buyer_tx_id UUID;
  seller_tx_id UUID;
  transaction_count INTEGER := 0;
  error_count INTEGER := 0;
  skipped_count INTEGER := 0;
  total_offers INTEGER := 0;
BEGIN
  -- Count total accepted offers
  SELECT COUNT(*) INTO total_offers
  FROM property_offers
  WHERE status = 'accepted';
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE 'Starting backfill for % accepted offers', total_offers;
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';

  -- Loop through all accepted offers
  FOR offer_record IN 
    SELECT 
      po.id as offer_id,
      po.property_id,
      po.buyer_id,
      po.seller_id,
      po.offer_amount,
      po.currency,
      po.offer_type,
      po.message,
      po.created_at,
      p.title as property_title,
      p.location as property_location
    FROM property_offers po
    LEFT JOIN properties p ON po.property_id = p.id
    WHERE po.status = 'accepted'
    ORDER BY po.created_at ASC
  LOOP
    RAISE NOTICE 'Processing offer: %', offer_record.offer_id;
    RAISE NOTICE '  Buyer ID: %', offer_record.buyer_id;
    RAISE NOTICE '  Seller ID: %', offer_record.seller_id;
    
    -- Check if transactions already exist for this offer
    IF EXISTS (
      SELECT 1 
      FROM transactions 
      WHERE metadata->>'offer_id' = offer_record.offer_id::TEXT
      LIMIT 1
    ) THEN
      skipped_count := skipped_count + 1;
      RAISE NOTICE '  ⊘ SKIPPED - Transactions already exist for this offer';
    ELSE
      BEGIN
        -- Create buyer transaction
        INSERT INTO transactions (
          user_id,
          property_id,
          transaction_type,
          amount,
          currency,
          status,
          description,
          metadata,
          created_at,
          updated_at
        ) VALUES (
          offer_record.buyer_id,
          offer_record.property_id,
          CASE 
            WHEN offer_record.offer_type = 'purchase' THEN 'purchase'
            ELSE 'rental'
          END,
          offer_record.offer_amount,
          COALESCE(offer_record.currency, 'INR'),
          'pending',
          'Property ' || CASE 
            WHEN offer_record.offer_type = 'purchase' THEN 'purchase' 
            ELSE 'rental' 
          END || ': ' || COALESCE(offer_record.property_title, 'Property'),
          jsonb_build_object(
            'offer_id', offer_record.offer_id::TEXT,
            'property_title', COALESCE(offer_record.property_title, 'Property'),
            'property_location', COALESCE(offer_record.property_location, ''),
            'offer_message', COALESCE(offer_record.message, ''),
            'transaction_flow', 'offer_accepted_backfill',
            'backfilled_at', NOW()::TEXT
          ),
          offer_record.created_at,
          NOW()
        )
        RETURNING id INTO buyer_tx_id;

        -- Create seller transaction
        INSERT INTO transactions (
          user_id,
          property_id,
          transaction_type,
          amount,
          currency,
          status,
          description,
          metadata,
          created_at,
          updated_at
        ) VALUES (
          offer_record.seller_id,
          offer_record.property_id,
          CASE 
            WHEN offer_record.offer_type = 'purchase' THEN 'sale'
            ELSE 'rental'
          END,
          offer_record.offer_amount,
          COALESCE(offer_record.currency, 'INR'),
          'pending',
          'Property ' || CASE 
            WHEN offer_record.offer_type = 'purchase' THEN 'sale' 
            ELSE 'rental' 
          END || ': ' || COALESCE(offer_record.property_title, 'Property'),
          jsonb_build_object(
            'offer_id', offer_record.offer_id::TEXT,
            'property_title', COALESCE(offer_record.property_title, 'Property'),
            'property_location', COALESCE(offer_record.property_location, ''),
            'buyer_id', offer_record.buyer_id,
            'transaction_flow', 'offer_accepted_backfill',
            'backfilled_at', NOW()::TEXT
          ),
          offer_record.created_at,
          NOW()
        )
        RETURNING id INTO seller_tx_id;

        transaction_count := transaction_count + 1;
        
        RAISE NOTICE '  ✓ SUCCESS - Created transactions:';
        RAISE NOTICE '    Buyer transaction: %', buyer_tx_id;
        RAISE NOTICE '    Seller transaction: %', seller_tx_id;
      EXCEPTION WHEN OTHERS THEN
        error_count := error_count + 1;
        RAISE WARNING '  ✗ ERROR - Failed to create transactions: %', SQLERRM;
        RAISE WARNING '    SQL State: %', SQLSTATE;
      END;
    END IF;
    
    RAISE NOTICE '';
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE 'Backfill Summary:';
  RAISE NOTICE '  Total accepted offers: %', total_offers;
  RAISE NOTICE '  ✓ Successfully created: % offers', transaction_count;
  RAISE NOTICE '  ⊘ Skipped (already exist): % offers', skipped_count;
  RAISE NOTICE '  ✗ Failed: % offers', error_count;
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

-- Step 4: Re-enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Step 5: Post-backfill verification
SELECT 
  'Post-Backfill Check' as phase,
  COUNT(*) as total_transactions,
  COUNT(CASE WHEN metadata->>'transaction_flow' = 'offer_accepted_backfill' THEN 1 END) as backfilled_transactions
FROM transactions;

-- Step 6: Show created transactions
SELECT 
  'Created Transactions' as phase,
  t.id,
  t.user_id,
  t.transaction_type,
  t.amount,
  t.status,
  t.metadata->>'offer_id' as offer_id,
  t.created_at
FROM transactions t
WHERE t.metadata->>'transaction_flow' = 'offer_accepted_backfill'
ORDER BY t.created_at DESC;

-- Step 7: Verify all accepted offers have transactions
SELECT 
  'Verification: Offers vs Transactions' as phase,
  COUNT(DISTINCT po.id) as total_accepted_offers,
  COUNT(DISTINCT t.id) as total_transactions,
  COUNT(DISTINCT CASE WHEN t.metadata->>'offer_id' = po.id::TEXT THEN po.id END) as offers_with_transactions
FROM property_offers po
LEFT JOIN transactions t ON t.metadata->>'offer_id' = po.id::TEXT
WHERE po.status = 'accepted';

SELECT '═══════════════════════════════════════════════════════════' as separator;
SELECT 'Backfill complete! Check the results above.' as message;
SELECT 'If transactions were created but still don''t show in Dashboard:' as note1;
SELECT '  1. Check your user_id matches the transaction user_id' as note2;
SELECT '  2. Run fix-transactions-rls.sql to fix RLS policies' as note3;
SELECT '  3. Check browser console for detailed error messages' as note4;


