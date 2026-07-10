import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    // 驗證admin身份
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 檢查係咪admin
    const { data: admin } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .eq('invite_status', 'active')
      .single();

    if (!admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // 1. Device status
    const { data: deviceStatus } = await supabase
      .from('device_heartbeat')
      .select('device_id, last_seen, status')
      .eq('device_id', 'main_door')
      .single();

    // 2. Relay mappings
    const { data: relays } = await supabase
      .from('door_room_relays')
      .select('table_number, relay_gpio, label')
      .eq('device_id', 'main_door')
      .order('table_number');

    // 3. Recent access logs (last 50)
    const { data: accessLogs } = await supabase
      .from('door_access_log')
      .select('id, device_id, method, identifier, result, reason, created_at')
      .eq('device_id', 'main_door')
      .order('created_at', { ascending: false })
      .limit(50);

    // 4. Active lockouts
    const now = new Date().toISOString();
    const { data: lockouts } = await supabase
      .from('door_lockouts')
      .select('device_id, scope, attempt_count, locked_until')
      .eq('device_id', 'main_door')
      .or(`locked_until.gte.${now},attempt_count.gt.0`);

    return NextResponse.json({
      success: true,
      device_status: deviceStatus,
      relays: relays || [],
      access_logs: accessLogs || [],
      lockouts: lockouts || [],
    });
  } catch (err) {
    console.error('[admin/door-status] error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
