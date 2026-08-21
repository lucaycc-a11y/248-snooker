-- Add phone_verified_at to public.users for tracking when a phone number was
-- verified via OTP. Null means the stored phone is unverified (legacy rows or
-- numbers entered during profile completion but not yet OTP-confirmed).
-- Safe to re-run: the ADD COLUMN is guarded against duplicate_column.

do $$
begin
  alter table public.users
    add column phone_verified_at timestamptz;
exception
  when duplicate_column then
    raise notice 'phone_verified_at already exists, skipping';
end $$;
