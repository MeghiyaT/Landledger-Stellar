-- ============================================================
-- Fix RLS for transactions
-- ============================================================

-- Ensure RLS is enabled
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert a transaction (necessary because the seller creates a transaction for the buyer when accepting an offer)
DROP POLICY IF EXISTS "Anyone can insert transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
CREATE POLICY "Anyone can insert transactions" ON transactions FOR INSERT WITH CHECK (true);

-- Allow users to view their own transactions, OR transactions where they are the buyer or seller
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT USING (
  user_id = public.clerk_user_id() OR
  (metadata->>'buyer_id') = public.clerk_user_id() OR
  (metadata->>'seller_id') = public.clerk_user_id()
);

-- Allow users to update their own transactions
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
CREATE POLICY "Users can update own transactions" ON transactions FOR UPDATE USING (
  user_id = public.clerk_user_id()
);
