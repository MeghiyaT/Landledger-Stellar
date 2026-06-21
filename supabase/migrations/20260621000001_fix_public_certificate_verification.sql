-- ============================================================
-- Fix: Allow public certificate verification
-- 
-- Problem: The existing SELECT policy on `registrations` only
-- allows a user to read their OWN records (or admins to read all).
-- When a third party opens a /verify/:id link, their Clerk user ID
-- doesn't match the record's user_id, so Supabase returns nothing
-- and the verifier shows "Certificate not found".
--
-- Fix: Add a second, public-facing SELECT policy that lets ANYONE
-- (including unauthenticated / anon users) read a registration row
-- if and only if its status is 'approved'.  This is safe because:
--   1. Only approved records are exposed — drafts/pending are hidden.
--   2. The verifier page already enforces status === 'approved' in
--      application code as a second check.
--   3. No writes are exposed by this policy.
-- ============================================================

DROP POLICY IF EXISTS "Anyone can verify an approved registration" ON registrations;

CREATE POLICY "Anyone can verify an approved registration"
ON registrations
FOR SELECT
USING (status = 'approved');
