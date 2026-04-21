-- Migration: Backfill transactions for accepted offers (BYPASSES RLS)
-- Run this in your Supabase SQL Editor
-- This version temporarily disables RLS to ensure transactions are created

-- Step 1: Temporarily disable RLS for transactions table
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;

-- Step 2: Backfill transactions
DO $$
DECLARE
  offer_record RECORD;
  buyer_tx_id UUID;
  seller_tx_id UUID;
  transaction_count INTEGER := 0;
  error_count INTEGER := 0;
BEGIN
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
    -- Check if transactions already exist for this offer
    IF NOT EXISTS (
      SELECT 1 
      FROM transactions 
      WHERE metadata->>'offer_id' = offer_record.offer_id::TEXT
      LIMIT 1
    ) THEN
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
        
        RAISE NOTICE '✓ Created transactions for offer %: buyer_tx=%, seller_tx=%', 
          offer_record.offer_id, buyer_tx_id, seller_tx_id;
      EXCEPTION WHEN OTHERS THEN
        error_count := error_count + 1;
        RAISE WARNING '✗ Failed to create transactions for offer %: %', 
          offer_record.offer_id, SQLERRM;
      END;
    ELSE
      RAISE NOTICE '⊘ Skipping offer % - transactions already exist', offer_record.offer_id;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE 'Backfill Summary:';
  RAISE NOTICE '  ✓ Successfully created transactions for % offers', transaction_count;
  RAISE NOTICE '  ✗ Failed to create transactions for % offers', error_count;
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

-- Step 3: Re-enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Step 4: Verify the backfill - Show all transactions created
SELECT 
  'Verification Query' as query_type,
  COUNT(*) as total_transactions_created
FROM transactions
WHERE metadata->>'transaction_flow' = 'offer_accepted_backfill';

-- Step 5: Show detailed breakdown
SELECT 
  t.id,
  t.user_id,
  t.transaction_type,
  t.amount,
  t.currency,
  t.status,
  t.metadata->>'offer_id' as offer_id,
  t.metadata->>'property_title' as property_title,
  t.created_at
FROM transactions t
WHERE t.metadata->>'transaction_flow' = 'offer_accepted_backfill'
ORDER BY t.created_at DESC;

-- Step 6: Show accepted offers vs transactions
SELECT 
  'Summary' as report_type,
  COUNT(DISTINCT po.id) as total_accepted_offers,
  COUNT(DISTINCT t.id) as total_transactions_for_offers,
  COUNT(DISTINCT CASE WHEN t.metadata->>'transaction_flow' = 'offer_accepted_backfill' THEN t.id END) as backfilled_transactions
FROM property_offers po
LEFT JOIN transactions t ON t.metadata->>'offer_id' = po.id::TEXT
WHERE po.status = 'accepted';

SELECT 'Backfill completed! Check the results above.' as message;
SELECT 'If transactions still don''t show in Dashboard, check RLS policies with: fix-transactions-rls.sql' as note;



