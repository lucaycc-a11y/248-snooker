-- Add wallet_notify_opt_in column to users table
-- Used by the Wallet locked-preview feature to track notification opt-ins
-- FIXED: Changed from 'profiles' to 'users' (profiles table does not exist)

ALTER TABLE users
ADD COLUMN IF NOT EXISTS wallet_notify_opt_in boolean DEFAULT false;

COMMENT ON COLUMN users.wallet_notify_opt_in IS 'User opted in to be notified when Wallet feature launches';
