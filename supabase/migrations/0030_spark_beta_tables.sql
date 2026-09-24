-- Spark (Beta) — Admin-only AI chat assistant
-- Tables for conversation history, messages, and feedback

-- spark_conversations: one row per conversation session
CREATE TABLE IF NOT EXISTS spark_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  locale TEXT NOT NULL DEFAULT 'zh-HK',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_spark_conversations_user_id ON spark_conversations(user_id);
CREATE INDEX idx_spark_conversations_created_at ON spark_conversations(created_at DESC);

-- spark_messages: individual messages within conversations
CREATE TABLE IF NOT EXISTS spark_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES spark_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  model TEXT, -- which model generated this (for assistant messages)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_spark_messages_conversation_id ON spark_messages(conversation_id, created_at);

-- spark_feedback: user ratings after conversation
CREATE TABLE IF NOT EXISTS spark_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES spark_conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  locale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_spark_feedback_conversation_id ON spark_feedback(conversation_id);
CREATE INDEX idx_spark_feedback_created_at ON spark_feedback(created_at DESC);

-- RLS Policies

ALTER TABLE spark_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE spark_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE spark_feedback ENABLE ROW LEVEL SECURITY;

-- Users can only see their own conversations
CREATE POLICY "Users can view their own conversations"
  ON spark_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations"
  ON spark_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view messages in their own conversations
CREATE POLICY "Users can view messages in their conversations"
  ON spark_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM spark_conversations
      WHERE spark_conversations.id = spark_messages.conversation_id
        AND spark_conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in their conversations"
  ON spark_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM spark_conversations
      WHERE spark_conversations.id = spark_messages.conversation_id
        AND spark_conversations.user_id = auth.uid()
    )
  );

-- Feedback: insert-only for the submitting user; service_role reads all
CREATE POLICY "Users can submit feedback for their conversations"
  ON spark_feedback FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM spark_conversations
      WHERE spark_conversations.id = spark_feedback.conversation_id
        AND spark_conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own feedback"
  ON spark_feedback FOR SELECT
  USING (auth.uid() = user_id);

-- Service role (admin queries) can see everything
-- (RLS bypassed automatically for service_role)

COMMENT ON TABLE spark_conversations IS 'Spark (Beta) conversation sessions (admin-only during beta)';
COMMENT ON TABLE spark_messages IS 'Individual messages within Spark conversations';
COMMENT ON TABLE spark_feedback IS 'User feedback on Spark conversation quality';
