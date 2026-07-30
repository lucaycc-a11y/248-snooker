-- ========================================
-- 248 Door System: Scoped TOTP Secrets + Multi-Table Bookings
-- ========================================

-- 1. door_secrets加scope欄位(分開大門/場A/場B)
ALTER TABLE door_secrets ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'main_door';

-- 移除舊unique constraint,改用device_id + scope做unique key
ALTER TABLE door_secrets DROP CONSTRAINT IF EXISTS door_secrets_device_id_key;
ALTER TABLE door_secrets ADD CONSTRAINT door_secrets_device_scope_unique UNIQUE(device_id, scope);

-- Insert場A、場B嘅獨立secret(如果未有)
INSERT INTO door_secrets (device_id, scope, secret_key)
VALUES
  ('main_door', 'table_1', encode(gen_random_bytes(32), 'hex')),
  ('main_door', 'table_2', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (device_id, scope) DO NOTHING;

-- 2. door_password_usage_log加scope欄位,track邊個場嘅密碼使用
ALTER TABLE door_password_usage_log ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'main_door';

-- 3. booking_tables junction table(一個booking可以訂多個場)
CREATE TABLE IF NOT EXISTS booking_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  table_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(booking_id, table_number)
);

-- 建立index加快查詢
CREATE INDEX IF NOT EXISTS idx_booking_tables_booking_id ON booking_tables(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_tables_table_number ON booking_tables(table_number);

-- 4. door_room_relays(場地對應relay GPIO嘅mapping)
CREATE TABLE IF NOT EXISTS door_room_relays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  table_number INTEGER NOT NULL UNIQUE,
  relay_gpio INTEGER NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 預設插入兩個場地嘅relay mapping(GPIO待確認,可以admin後台改)
INSERT INTO door_room_relays (device_id, table_number, relay_gpio, label)
VALUES
  ('main_door', 1, 25, '場A'),
  ('main_door', 2, 26, '場B')
ON CONFLICT (table_number) DO NOTHING;

-- 5. admin_users加admin QR相關欄位
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS admin_qr_code TEXT UNIQUE;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS admin_qr_generated_at TIMESTAMPTZ;

-- 6. door_commands(admin遠程觸發開門/調整secret嘅指令隊列)
CREATE TABLE IF NOT EXISTS door_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  command JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  executed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_door_commands_device_status ON door_commands(device_id, status, created_at);

-- 7. door_lockouts(記錄keypad lockout狀態)
CREATE TABLE IF NOT EXISTS door_lockouts (
  device_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  attempt_count INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (device_id, scope)
);

-- 8. RLS policies(全部新表鎖死,得service_role可以寫)
ALTER TABLE booking_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE door_room_relays ENABLE ROW LEVEL SECURITY;
ALTER TABLE door_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE door_lockouts ENABLE ROW LEVEL SECURITY;

-- booking_tables: service_role可以全權操作,admin可以讀
CREATE POLICY "service_role_full_access_booking_tables" ON booking_tables FOR ALL USING (true);
CREATE POLICY "admin_read_booking_tables" ON booking_tables FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.invite_status = 'active'
  ));

-- door_room_relays: service_role可以全權操作,admin可以讀寫
CREATE POLICY "service_role_full_access_relays" ON door_room_relays FOR ALL USING (true);
CREATE POLICY "admin_manage_relays" ON door_room_relays FOR ALL
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.invite_status = 'active'
  ));

-- door_commands: service_role可以全權操作,admin可以插入同讀自己嘅指令
CREATE POLICY "service_role_full_access_commands" ON door_commands FOR ALL USING (true);
CREATE POLICY "admin_insert_commands" ON door_commands FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.invite_status = 'active'
  ));
CREATE POLICY "admin_read_own_commands" ON door_commands FOR SELECT
  USING (created_by = auth.uid());

-- door_lockouts: service_role全權,admin只可以讀
CREATE POLICY "service_role_full_access_lockouts" ON door_lockouts FOR ALL USING (true);
CREATE POLICY "admin_read_lockouts" ON door_lockouts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.invite_status = 'active'
  ));
