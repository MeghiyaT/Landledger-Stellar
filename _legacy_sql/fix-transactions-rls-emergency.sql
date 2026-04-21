-- Emergency Fix: Disable RLS for transactions table (for debugging)
-- Run this in your Supabase SQL Editor
-- WARNING: This disables security. Only use for debugging, then re-enable with proper policies.

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can create own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;

-- Temporarily disable RLS for debugging
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;

SELECT '⚠️ WARNING: RLS has been DISABLED for transactions table!' as warning;
SELECT 'This is for debugging only. Re-enable RLS after fixing the issue.' as note;
SELECT 'To re-enable: ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;' as re_enable_command;



