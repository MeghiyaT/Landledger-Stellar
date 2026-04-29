-- ============================================================
-- Remove Rent Concepts
-- ============================================================

-- Remove any rental offers from the database
DELETE FROM property_offers WHERE offer_type = 'rental';

-- Remove any rental properties from the database
DELETE FROM properties WHERE listing_type = 'for_rent' OR status = 'rented' OR listing_type = 'rent';

-- Update property_offers check constraint to only allow 'purchase'
ALTER TABLE property_offers DROP CONSTRAINT IF EXISTS property_offers_offer_type_check;
ALTER TABLE property_offers ADD CONSTRAINT property_offers_offer_type_check 
  CHECK (offer_type IN ('purchase'));

-- Update properties status check constraint to remove 'for_rent' and 'rented'
ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_status_check;
ALTER TABLE properties ADD CONSTRAINT properties_status_check 
  CHECK (status IN ('active', 'for_sale', 'sold', 'paused', 'under_contract'));

-- Update properties listing_type default
ALTER TABLE properties ALTER COLUMN listing_type SET DEFAULT 'for_sale';
