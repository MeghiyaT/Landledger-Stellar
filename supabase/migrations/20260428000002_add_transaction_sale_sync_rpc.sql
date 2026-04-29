-- Security-definer helpers for property sale state transitions.
-- These replace client-side service-role usage for property ownership sync.

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

  UPDATE public.properties
  SET
    user_id = tx_record.user_id,
    status = 'sold',
    sold_to = tx_record.user_id,
    sold_at = NOW(),
    nft_transfer_tx_hash = COALESCE(nft_hash, nft_transfer_tx_hash),
    updated_at = NOW()
  WHERE id = tx_record.property_id;

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

CREATE OR REPLACE FUNCTION public.fail_property_sale_sync(tx_id UUID)
RETURNS TABLE (
  property_id UUID,
  other_transaction_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acting_user TEXT := public.clerk_user_id();
  tx_record transactions%ROWTYPE;
BEGIN
  SELECT *
  INTO tx_record
  FROM public.transactions
  WHERE id = tx_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF acting_user IS NULL OR (
    acting_user <> tx_record.user_id
    AND acting_user <> COALESCE(tx_record.metadata->>'buyer_id', '')
    AND acting_user <> COALESCE(tx_record.metadata->>'seller_id', '')
  ) THEN
    RAISE EXCEPTION 'Not authorized to cancel this sale';
  END IF;

  UPDATE public.properties
  SET
    status = 'for_sale',
    sold_to = NULL,
    sold_at = NULL,
    updated_at = NOW()
  WHERE id = tx_record.property_id;

  UPDATE public.transactions
  SET
    status = 'failed',
    description = 'Transaction cancelled or failed.',
    updated_at = NOW()
  WHERE property_id = tx_record.property_id
    AND id <> tx_record.id
    AND status IN ('in_progress', 'pending');

  RETURN QUERY
  SELECT
    tx_record.property_id,
    t.id
  FROM public.transactions t
  WHERE t.property_id = tx_record.property_id
    AND t.id <> tx_record.id
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_property_sale_sync(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fail_property_sale_sync(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_property_sale_sync(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fail_property_sale_sync(UUID) TO authenticated;
