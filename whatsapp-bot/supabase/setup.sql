-- 248 WhatsApp Bot setup
-- Run this in the Supabase SQL Editor for project wqmciwieiqvnswvspdyz.

CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  message_id text UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_conversations_phone_created_at_idx
  ON public.whatsapp_conversations(phone, created_at);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_whatsapp_conversations" ON public.whatsapp_conversations;
CREATE POLICY "service_role_all_whatsapp_conversations"
  ON public.whatsapp_conversations
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.whatsapp_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_otps_phone_created_at_idx
  ON public.whatsapp_otps(phone, created_at DESC);

ALTER TABLE public.whatsapp_otps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_whatsapp_otps" ON public.whatsapp_otps;
CREATE POLICY "service_role_all_whatsapp_otps"
  ON public.whatsapp_otps
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.bot_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.bot_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_bot_config" ON public.bot_config;
CREATE POLICY "service_role_all_bot_config"
  ON public.bot_config
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

INSERT INTO public.bot_config (key, value) VALUES
  ('personality', '"你係248 Snooker嘅專業客服助手，用繁體廣東話書面語回覆，簡短友善，每次唔超過3句。唔確定嘅嘢唔好亂講。"'::jsonb),
  ('auto_reply', 'true'::jsonb),
  ('greeting', '"你好！我係248 Snooker客服，有咩可以幫到你？😊"'::jsonb)
ON CONFLICT (key) DO NOTHING;
