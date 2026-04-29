-- ============================================================
-- Add 'under_contract' as a valid property status
-- ============================================================

-- Drop the existing check constraint and recreate with new value
ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_status_check;

ALTER TABLE properties ADD CONSTRAINT properties_status_check 
  CHECK (status IN ('for_sale', 'for_rent', 'sold', 'rented', 'paused', 'under_contract'));

-- Reset the demo property back to under_contract (since escrow is in_progress, not yet completed)
UPDATE properties 
SET status = 'under_contract', sold_at = NULL
WHERE id = '23574431-a3c1-408c-888d-bcd8993f5876';
