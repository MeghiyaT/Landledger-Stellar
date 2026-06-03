-- Backfill ownership_transfers for all previously completed sales.
-- Run this AFTER the main migration (20260603000001_add_ownership_transfers.sql).
-- Safe to run multiple times — skips transactions that already have a transfer record.

INSERT INTO public.ownership_transfers (
  property_id,
  from_owner_id,
  to_owner_id,
  from_wallet,
  to_wallet,
  transfer_type,
  transaction_id,
  blockchain_tx_hash,
  nft_transfer_tx_hash,
  created_at
)
SELECT
  t.property_id,
  t.metadata->>'seller_id',
  t.user_id,
  t.metadata->>'seller_wallet',
  t.metadata->>'buyer_wallet',
  'sale',
  t.id,
  t.blockchain_tx_hash,
  p.nft_transfer_tx_hash,
  COALESCE(p.sold_at, t.updated_at, NOW())
FROM public.transactions t
JOIN public.properties p ON p.id = t.property_id
WHERE t.transaction_type = 'purchase'
  AND t.status = 'completed'
  AND NOT EXISTS (
    SELECT 1 FROM public.ownership_transfers ot
    WHERE ot.transaction_id = t.id
  )
ORDER BY t.updated_at ASC;
