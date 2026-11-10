-- Pricing v2 kill switch: enabled=false reverts EVERYONE (admins included) to
-- pre-v2 pricing + booking cutoff instantly, without touching the go-live
-- schedule in public_from. Toggled from admin settings via
-- /api/admin/pricing-v2. Additive only, idempotent.

ALTER TABLE public.pricing_v2_config
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;
