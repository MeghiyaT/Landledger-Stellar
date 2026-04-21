-- Fix purchased properties for offers accepted before purchased section was added
-- This script finds properties that should be in purchased properties but might be missing sold_to or sold_at

-- Step 1: Find accepted purchase offers and their properties
-- Check which properties have sold_to set but might be missing from purchased properties query
DO $$
DECLARE
  offer_record RECORD;
  property_record RECORD;
  fixed_count INTEGER := 0;
BEGIN
  RAISE NOTICE '=== Fixing purchased properties for old accepted offers ===';
  
  -- Loop through all accepted purchase offers
  FOR offer_record IN 
    SELECT 
      po.id as offer_id,
      po.property_id,
      po.buyer_id,
      po.seller_id,
      po.offer_amount,
      po.created_at as offer_created_at,
      p.id as property_id_check,
      p.sold_to,
      p.sold_at,
      p.user_id as property_user_id
    FROM property_offers po
    LEFT JOIN properties p ON p.id = po.property_id
    WHERE po.status = 'accepted'
      AND po.offer_type = 'purchase'
    ORDER BY po.created_at DESC
  LOOP
    RAISE NOTICE '--- Processing offer % (property %) ---', offer_record.offer_id, offer_record.property_id;
    RAISE NOTICE 'Buyer ID: %', offer_record.buyer_id;
    RAISE NOTICE 'Property sold_to: %', offer_record.sold_to;
    RAISE NOTICE 'Property sold_at: %', offer_record.sold_at;
    RAISE NOTICE 'Property user_id: %', offer_record.property_user_id;
    
    -- Check if property needs fixing
    IF offer_record.sold_to IS NULL OR offer_record.sold_at IS NULL THEN
      RAISE NOTICE 'Property needs fixing: sold_to or sold_at is NULL';
      
      -- Update property to set sold_to and sold_at
      UPDATE properties
      SET 
        sold_to = offer_record.buyer_id,
        sold_at = COALESCE(offer_record.sold_at, offer_record.offer_created_at, NOW()),
        updated_at = NOW()
      WHERE id = offer_record.property_id;
      
      IF FOUND THEN
        fixed_count := fixed_count + 1;
        RAISE NOTICE '✓ Fixed property %: set sold_to=%, sold_at=%', 
          offer_record.property_id, 
          offer_record.buyer_id,
          COALESCE(offer_record.sold_at, offer_record.offer_created_at, NOW());
      ELSE
        RAISE WARNING '✗ Failed to update property %', offer_record.property_id;
      END IF;
    ELSE
      RAISE NOTICE 'Property already has sold_to and sold_at set';
    END IF;
    
    RAISE NOTICE '';
  END LOOP;
  
  RAISE NOTICE '=== Fix complete! Fixed % properties ===', fixed_count;
END $$;

-- Step 2: Verify the fix
-- Show all properties that should appear in purchased properties
SELECT 
  p.id,
  p.title,
  p.sold_to as buyer_id,
  p.sold_at,
  p.user_id as current_owner,
  po.id as offer_id,
  po.status as offer_status,
  po.created_at as offer_created_at
FROM properties p
INNER JOIN property_offers po ON po.property_id = p.id
WHERE po.status = 'accepted'
  AND po.offer_type = 'purchase'
  AND p.sold_to IS NOT NULL
  AND p.sold_at IS NOT NULL
ORDER BY p.sold_at DESC;

-- Step 3: Check for any properties that still need fixing
SELECT 
  p.id,
  p.title,
  p.sold_to,
  p.sold_at,
  po.buyer_id as expected_buyer_id,
  po.created_at as offer_created_at
FROM properties p
INNER JOIN property_offers po ON po.property_id = p.id
WHERE po.status = 'accepted'
  AND po.offer_type = 'purchase'
  AND (p.sold_to IS NULL OR p.sold_at IS NULL)
ORDER BY po.created_at DESC;


