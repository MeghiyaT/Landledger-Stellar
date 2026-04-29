-- Expose only wallet addresses needed for escrow and NFT handoffs.
-- This avoids using the Supabase service role key in the browser.

CREATE OR REPLACE FUNCTION public.get_wallet_addresses(profile_ids TEXT[])
RETURNS TABLE (
  id TEXT,
  wallet_address TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.wallet_address
  FROM public.profiles p
  WHERE p.id = ANY(profile_ids);
$$;

REVOKE ALL ON FUNCTION public.get_wallet_addresses(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_wallet_addresses(TEXT[]) TO authenticated;
