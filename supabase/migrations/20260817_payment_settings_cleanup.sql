-- 20260817_payment_settings_cleanup
--
-- Drop the legacy `provider` column from payment_settings (all methods now
-- use KPay exclusively; provider is no longer a meaningful column).
-- Also removes apple_pay / google_pay rows (UI-only, no provider mapping)
-- and seeds `card` (enabled) so the create/status routes can gate against it.
--
-- Runs after 20260817_payment_settings_and_kpay.sql and
-- 20260817_kpay_extended_methods.sql.
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Drop provider column ──────────────────────────────────────────────────

alter table public.payment_settings
  drop column if exists provider;

-- ── 2. Remove apple_pay / google_pay (UI-only, never routed to a provider) ──

delete from public.payment_settings
  where method in ('apple_pay', 'google_pay');

-- ── 3. Seed card (enabled — routes to KPay CNP Hosted) ─────────────────────

insert into public.payment_settings (method, enabled) values
  ('card', true)
on conflict (method) do update set enabled = true, updated_at = now();
