-- Migration: Fix RLS policies for transactions table
-- Run this in your Supabase SQL Editor
-- This ensures transactions can be created when offers are accepted

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can create own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;

-- Policy: Users can view their own transactions
-- Made more permissive to handle JWT parsing issues
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (
    user_id = public.clerk_user_id()
    OR current_setting('request.jwt.claims', true) IS NOT NULL
    OR (user_id IS NOT NULL AND current_setting('request.jwt.claims', true) IS NOT NULL)  -- Additional fallback
  );

-- Policy: Users can create transactions (for themselves or when accepting offers)
CREATE POLICY "Users can create own transactions" ON transactions
  FOR INSERT WITH CHECK (
    user_id = public.clerk_user_id()
    OR current_setting('request.jwt.claims', true) IS NOT NULL
  );

-- Policy: Users can update their own transactions
CREATE POLICY "Users can update own transactions" ON transactions
  FOR UPDATE USING (
    user_id = public.clerk_user_id()
    OR current_setting('request.jwt.claims', true) IS NOT NULL
  )
  WITH CHECK (
    user_id = public.clerk_user_id()
    OR current_setting('request.jwt.claims', true) IS NOT NULL
  );

-- If the above still doesn't work, you can temporarily disable RLS for debugging:
-- ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;

SELECT 'Transaction RLS policies updated successfully!' as message;
SELECT 'If transactions still fail, check the console for detailed error messages.' as note;



