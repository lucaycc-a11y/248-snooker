-- CS workflow: server-enforced identity check + Spark's structured verdict per case.
alter table public.cs_cases
  add column if not exists identity_verified_at timestamptz,
  add column if not exists identity_skipped_at timestamptz,
  add column if not exists spark_verdict jsonb;
