-- ════════════════════════════════════════════════════════════════════════════
-- Migration: Create admin_notifications table
-- Purpose: Fix production error (digest 835698500) caused by missing table
-- Date: 2026-09-25
-- ════════════════════════════════════════════════════════════════════════════

-- Create admin_notifications table
CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- info, warning, success, error
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
-- Primary query: WHERE user_id = ? AND read = false (used in getMemberRedesign.ts:36-39)
CREATE INDEX IF NOT EXISTS idx_admin_notifications_user_read
  ON admin_notifications(user_id, read);

-- Secondary index: user_id for general queries
CREATE INDEX IF NOT EXISTS idx_admin_notifications_user_id
  ON admin_notifications(user_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_admin_notifications_updated_at
  BEFORE UPDATE ON admin_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE admin_notifications IS 'System notifications sent to members from admin';
