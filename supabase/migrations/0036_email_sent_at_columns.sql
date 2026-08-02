-- Add tracking columns for email notifications
alter table public.bookings
  add column if not exists confirmation_email_sent_at timestamptz,
  add column if not exists reminder_email_sent_at timestamptz;