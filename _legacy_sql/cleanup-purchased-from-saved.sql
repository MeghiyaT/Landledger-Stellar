-- Cleanup script: Remove purchased properties from saved_properties table
-- This ensures that properties users have purchased don't appear in their favorites

-- Step 1: Find and remove saved properties where the property has been sold to the user
DELETE FROM saved_properties
WHERE EXISTS (
  SELECT 1
  FROM properties p
  WHERE p.id = saved_properties.property_id
    AND p.sold_to = saved_properties.user_id
    AND p.sold_at IS NOT NULL
);

-- Step 2: Show summary of what was cleaned up
SELECT 
  COUNT(*) as removed_count,
  'Properties removed from saved_properties (purchased by user)' as description
FROM saved_properties
WHERE EXISTS (
  SELECT 1
  FROM properties p
  WHERE p.id = saved_properties.property_id
    AND p.sold_to = saved_properties.user_id
    AND p.sold_at IS NOT NULL
);

-- Step 3: Verify cleanup - show any remaining saved properties that are purchased
SELECT 
  sp.id as saved_property_id,
  sp.user_id,
  sp.property_id,
  p.title as property_title,
  p.sold_to,
  p.sold_at
FROM saved_properties sp
INNER JOIN properties p ON p.id = sp.property_id
WHERE p.sold_to = sp.user_id
  AND p.sold_at IS NOT NULL;


