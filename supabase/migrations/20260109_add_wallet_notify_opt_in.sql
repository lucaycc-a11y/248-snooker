-- Add wallet_notify_opt_in column to profiles table
-- Used by the Wallet locked-preview feature to track notification opt-ins

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS wallet_notify_opt_in boolean DEFAULT false;

COMMENT ON COLUMN profiles.wallet_notify_opt_in IS 'User opted in to be notified when Wallet feature launches';
