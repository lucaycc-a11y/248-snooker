-- Fix pricing time range inconsistency
--
-- ISSUE: Migration 20260714_pricing_2026_rates.sql defined afternoon as 12:00-16:00,
-- but ALL code (lib/data/pricing.ts, tests, etc.) expects 12:00-18:00.
--
-- This migration corrects the afternoon period to match code expectations.
-- Safe to re-run: plain UPDATE of the config row.
--
-- Correct time ranges (matching all code):
--   morning   06:00-12:00  HK$88  (HK$78/h when 2h+ contiguous)
--   afternoon 12:00-18:00  HK$98  (HK$88/h when 2h+ contiguous)
--   evening   18:00-24:00  HK$108 (no multi-hour discount)

UPDATE public.config
SET value = jsonb_set(
  value,
  '{periods}',
  jsonb_build_array(
    jsonb_build_object('id','morning',  'rate',88,  'rateFrom2h',78, 'start','06:00','end','12:00','days','all'),
    jsonb_build_object('id','afternoon','rate',98,  'rateFrom2h',88, 'start','12:00','end','18:00','days','all'),
    jsonb_build_object('id','evening',  'rate',108,                  'start','18:00','end','24:00','days','all')
  )
)
WHERE key = 'pricing';
