-- Create webhook_events table for idempotency tracking
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by event_id
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);

-- Index for querying by provider and event_type
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_type ON webhook_events(provider, event_type);

-- Index for time-based queries and cleanup
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at DESC);

COMMENT ON TABLE webhook_events IS 'Webhook event log for payment provider callbacks - ensures idempotent processing';
COMMENT ON COLUMN webhook_events.event_id IS 'Provider event ID (Stripe event.id, KPay transaction ID)';
COMMENT ON COLUMN webhook_events.provider IS 'Payment provider: stripe, kpay';
COMMENT ON COLUMN webhook_events.payload IS 'Full webhook payload for debugging';
COMMENT ON COLUMN webhook_events.processed_at IS 'When the webhook was successfully processed';
