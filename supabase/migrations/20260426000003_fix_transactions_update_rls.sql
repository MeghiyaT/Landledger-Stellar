-- ============================================================
-- Fix RLS for transactions UPDATE
-- ============================================================

-- Allow users to update their own transactions, OR transactions where they are the buyer or seller
-- This is necessary so the buyer can update the seller's transaction status to 'in_progress'
-- when the buyer successfully creates the escrow.
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
CREATE POLICY "Users can update own transactions" ON transactions FOR UPDATE USING (
  user_id = public.clerk_user_id() OR
  (metadata->>'buyer_id') = public.clerk_user_id() OR
  (metadata->>'seller_id') = public.clerk_user_id()
);
