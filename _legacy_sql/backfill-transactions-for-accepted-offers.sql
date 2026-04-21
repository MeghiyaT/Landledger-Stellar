-- Migration: Backfill transactions for accepted offers created before transactional flow
-- Run this in your Supabase SQL Editor
-- This creates transactions for offers that were accepted before acceptOfferAndCreateTransaction was implemented

-- First, let's see what accepted offers exist without transactions
DO $$
DECLARE
  offer_record RECORD;
  buyer_tx_id UUID;
  seller_tx_id UUID;
  property_title TEXT;
  property_location TEXT;
  transaction_count INTEGER := 0;
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
    -- We check by looking for transactions with matching offer_id in metadata
    IF NOT EXISTS (
      SELECT 1 
      FROM transactions 
      WHERE metadata->>'offer_id' = offer_record.offer_id::TEXT
      LIMIT 1
    ) THEN
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
        offer_record.created_at, -- Use the original offer creation date
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
        offer_record.created_at, -- Use the original offer creation date
        NOW()
      )
      RETURNING id INTO seller_tx_id;

      transaction_count := transaction_count + 1;
      
      RAISE NOTICE 'Created transactions for offer %: buyer_tx=%, seller_tx=%', 
        offer_record.offer_id, buyer_tx_id, seller_tx_id;
    ELSE
      RAISE NOTICE 'Skipping offer % - transactions already exist', offer_record.offer_id;
    END IF;
  END LOOP;

  RAISE NOTICE 'Backfill complete! Created transactions for % accepted offers.', transaction_count;
END $$;

-- Verify the backfill
SELECT 
  COUNT(DISTINCT po.id) as total_accepted_offers,
  COUNT(DISTINCT t.id) as total_transactions,
  COUNT(DISTINCT CASE WHEN t.metadata->>'transaction_flow' = 'offer_accepted_backfill' THEN t.id END) as backfilled_transactions
FROM property_offers po
LEFT JOIN transactions t ON t.metadata->>'offer_id' = po.id::TEXT
WHERE po.status = 'accepted';

SELECT 'Backfill completed! Check the results above.' as message;



