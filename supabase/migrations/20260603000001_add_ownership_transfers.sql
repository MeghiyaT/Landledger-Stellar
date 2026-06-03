-- Ownership Transfer History
-- Records every property ownership change on-chain so the UI can display
-- a verifiable history of who owned the property and when.

-- 1. Create the ownership_transfers table
CREATE TABLE IF NOT EXISTS public.ownership_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  from_owner_id TEXT,          -- Clerk user ID of the seller (NULL for initial mint)
  to_owner_id TEXT NOT NULL,   -- Clerk user ID of the buyer / new owner
  from_wallet TEXT,            -- Seller's Stellar wallet address
  to_wallet TEXT,              -- Buyer's Stellar wallet address
  transfer_type TEXT NOT NULL DEFAULT 'sale',  -- 'mint' | 'sale'
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  blockchain_tx_hash TEXT,     -- Escrow completion tx hash
  nft_transfer_tx_hash TEXT,   -- NFT deed transfer tx hash
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by property
CREATE INDEX IF NOT EXISTS idx_ownership_transfers_property_id
  ON public.ownership_transfers(property_id);

-- Index for lookups by owner
CREATE INDEX IF NOT EXISTS idx_ownership_transfers_to_owner
  ON public.ownership_transfers(to_owner_id);

-- 2. RLS policies
ALTER TABLE public.ownership_transfers ENABLE ROW LEVEL SECURITY;

-- Anyone can read ownership history (it's public/transparent data)
DROP POLICY IF EXISTS "ownership_transfers_select" ON public.ownership_transfers;
CREATE POLICY "ownership_transfers_select"
  ON public.ownership_transfers FOR SELECT
  USING (true);

-- Only authenticated users can insert (the service layer controls who)
DROP POLICY IF EXISTS "ownership_transfers_insert" ON public.ownership_transfers;
CREATE POLICY "ownership_transfers_insert"
  ON public.ownership_transfers FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3. Update complete_property_sale_sync to atomically record the transfer
CREATE OR REPLACE FUNCTION public.complete_property_sale_sync(
  tx_id UUID,
  nft_hash TEXT DEFAULT NULL
)
RETURNS TABLE (
  property_id UUID,
  property_title TEXT,
  seller_transaction_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acting_user TEXT := public.clerk_user_id();
  tx_record transactions%ROWTYPE;
  prev_owner_id TEXT;
BEGIN
  SELECT *
  INTO tx_record
  FROM public.transactions
  WHERE id = tx_id
    AND transaction_type = 'purchase';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase transaction not found';
  END IF;

  IF acting_user IS NULL OR (
    acting_user <> tx_record.user_id
    AND acting_user <> COALESCE(tx_record.metadata->>'buyer_id', '')
    AND acting_user <> COALESCE(tx_record.metadata->>'seller_id', '')
  ) THEN
    RAISE EXCEPTION 'Not authorized to complete this sale';
  END IF;

  -- Capture the current owner before we overwrite it
  SELECT p.user_id INTO prev_owner_id
  FROM public.properties p
  WHERE p.id = tx_record.property_id;

  -- Update property ownership
  UPDATE public.properties
  SET
    user_id = tx_record.user_id,
    status = 'sold',
    sold_to = tx_record.user_id,
    sold_at = NOW(),
    nft_transfer_tx_hash = COALESCE(nft_hash, nft_transfer_tx_hash),
    updated_at = NOW()
  WHERE id = tx_record.property_id;

  -- Record the ownership transfer
  INSERT INTO public.ownership_transfers (
    property_id,
    from_owner_id,
    to_owner_id,
    from_wallet,
    to_wallet,
    transfer_type,
    transaction_id,
    blockchain_tx_hash,
    nft_transfer_tx_hash
  ) VALUES (
    tx_record.property_id,
    COALESCE(tx_record.metadata->>'seller_id', prev_owner_id),
    tx_record.user_id,
    tx_record.metadata->>'seller_wallet',
    tx_record.metadata->>'buyer_wallet',
    'sale',
    tx_record.id,
    tx_record.blockchain_tx_hash,
    nft_hash
  );

  -- Sync the seller's transaction
  UPDATE public.transactions
  SET
    status = 'completed',
    updated_at = NOW()
  WHERE property_id = tx_record.property_id
    AND transaction_type = 'sale'
    AND id <> tx_record.id
    AND status IN ('in_progress', 'pending');

  RETURN QUERY
  SELECT
    p.id,
    p.title,
    t.id
  FROM public.properties p
  LEFT JOIN public.transactions t
    ON t.property_id = p.id
   AND t.transaction_type = 'sale'
   AND t.id <> tx_record.id
  WHERE p.id = tx_record.property_id
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_property_sale_sync(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_property_sale_sync(UUID, TEXT) TO authenticated;
