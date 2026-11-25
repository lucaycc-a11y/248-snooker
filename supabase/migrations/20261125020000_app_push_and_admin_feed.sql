-- iOS admin app: push device tokens + shared admin activity feed.
-- Service-role only (RLS on, no policies); all access goes through /api/admin/app/*.

CREATE TABLE IF NOT EXISTS public.app_push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'ios',
  environment text NOT NULL DEFAULT 'production' CHECK (environment IN ('production', 'sandbox')),
  locale text,
  app_version text,
  enabled boolean NOT NULL DEFAULT true,
  -- Per-kind opt-out, e.g. {"booking_new": false}. Missing key = on.
  prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_app_push_devices_user ON public.app_push_devices (user_id) WHERE enabled;
ALTER TABLE public.app_push_devices ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.app_admin_feed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Prevents duplicate events (e.g. "booking:<id>") when a confirmation is re-sent.
  dedupe_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_app_admin_feed_created ON public.app_admin_feed (created_at DESC);
ALTER TABLE public.app_admin_feed ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.app_admin_feed_state (
  user_id uuid PRIMARY KEY,
  last_read_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_admin_feed_state ENABLE ROW LEVEL SECURITY;
