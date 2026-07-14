-- 248 Snooker — 2026 rate card for the /book redesign.
-- Run this in the Supabase SQL Editor for project wqmciwieiqvnswvspdyz.
-- Safe to re-run: plain UPDATE of the config rows.
--
-- New per-hour rates (all days; venue hours 06:00–24:00, no latenight period):
--   morning   06:00–12:00  HK$88  (HK$78/h when the contiguous block is 2h+)
--   afternoon 12:00–16:00  HK$98  (HK$88/h when the contiguous block is 2h+)
--   evening   16:00–24:00  HK$108 (no multi-hour discount)
--
-- `rateFrom2h` is read by lib/pricing.calculatePrice(): a contiguous block of
-- 2h+ bills every hour whose period defines it at the discounted rate. The
-- discount is per contiguous block, never across a whole multi-block order.
-- Client display (quoteBlockTotal) and the Stripe charge (create-intent →
-- calculatePrice) both read this same config row, so they can never diverge.

update public.config
set value = jsonb_set(
  value,
  '{periods}',
  jsonb_build_array(
    jsonb_build_object('id','morning',  'rate',88,  'rateFrom2h',78, 'start','06:00','end','12:00','days','all'),
    jsonb_build_object('id','afternoon','rate',98,  'rateFrom2h',88, 'start','12:00','end','16:00','days','all'),
    jsonb_build_object('id','evening',  'rate',108,                  'start','16:00','end','24:00','days','all')
  )
)
where key = 'pricing';

-- Venue opens 06:00 (site config previously said 0).
update public.config
set value = jsonb_set(value, '{openHour}', '6')
where key = 'site';
