-- AI daily insights: pre-generated daily by cron, never live-called on page load.

CREATE TABLE IF NOT EXISTS public.ai_daily_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  insights jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_daily_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_daily_insights_service_role_all ON public.ai_daily_insights;
CREATE POLICY ai_daily_insights_service_role_all ON public.ai_daily_insights
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS ai_daily_insights_date_idx ON public.ai_daily_insights (date DESC);
