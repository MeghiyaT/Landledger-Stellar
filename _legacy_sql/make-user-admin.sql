-- Make a User Admin
-- Replace 'YOUR_CLERK_USER_ID' with your actual Clerk user ID
-- 
-- How to find your Clerk User ID:
-- 1. Log in to your app
-- 2. Open browser console (F12)
-- 3. Type: window.Clerk?.user?.id
-- 4. Copy the ID that appears
-- OR
-- 1. Go to Clerk Dashboard → Users
-- 2. Find your user and copy the User ID

-- Option 1: If user already has a profile
UPDATE profiles 
SET is_admin = true 
WHERE id = 'YOUR_CLERK_USER_ID';

-- Option 2: If user doesn't have a profile yet (create one)
INSERT INTO profiles (id, is_admin) 
VALUES ('YOUR_CLERK_USER_ID', true)
ON CONFLICT (id) DO UPDATE SET is_admin = true;

-- Verify the user is now admin
SELECT id, is_admin, full_name 
FROM profiles 
WHERE id = 'YOUR_CLERK_USER_ID';







