-- Fix ambiguous column reference in complete_property_sale_sync

DROP FUNCTION IF EXISTS public.complete_property_sale_sync(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.complete_property_sale_sync(
  tx_id UUID,
  nft_hash TEXT DEFAULT NULL
)
RETURNS TABLE (
  out_property_id UUID,
  out_property_title TEXT,
  out_seller_transaction_id UUID
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
    p.id AS out_property_id,
    p.title AS out_property_title,
    t.id AS out_seller_transaction_id
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
