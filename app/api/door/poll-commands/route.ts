import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DOOR_API_KEY = process.env.DOOR_API_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { api_key, device_id } = await req.json();

    if (api_key !== DOOR_API_KEY) {
      return NextResponse.json({ success: false, reason: 'invalid_api_key' }, { status: 401 });
    }

    // 更新heartbeat,話俾系統知呢個裝置而家online
    await supabase
      .from('device_heartbeat')
      .upsert({
        device_id,
        last_seen: new Date().toISOString(),
        status: 'online',
      }, { onConflict: 'device_id' });

    const { data: command } = await supabase
      .from('door_commands')
      .select('id, command')
      .eq('device_id', device_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (command) {
      await supabase
        .from('door_commands')
        .update({ status: 'executed', executed_at: new Date().toISOString() })
        .eq('id', command.id);

      return NextResponse.json({ success: true, command: command.command });
    }

    return NextResponse.json({ success: true, command: null });
  } catch (err) {
    console.error('[door/poll-commands] error:', err);
    return NextResponse.json({ success: false, reason: 'server_error' }, { status: 500 });
  }
}
