import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // 1. 驗證admin身份
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
      .select('id, invite_status')
      .eq('id', user.id)
      .eq('invite_status', 'active')
      .single();

    if (!admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { action, device_id, scope, tables } = body;

    if (!device_id) {
      return NextResponse.json({ error: 'Missing device_id' }, { status: 400 });
    }

    // 2. 根據action執行操作
    if (action === 'open_door') {
      // 插入一個open_door指令俾ESP32 poll返去
      const command = {
        device_id,
        command: JSON.stringify({
          action: 'open_door',
          scope: scope || 'main_door',
          tables: tables || [],
          duration_ms: 5000, // 開5秒
        }),
        status: 'pending',
        created_by: user.id,
      };

      await supabase.from('door_commands').insert(command);

      await supabase.from('door_access_log').insert({
        device_id,
        method: 'admin_override',
        identifier: user.email || user.id,
        result: 'success',
        reason: 'manual_open',
      });

      return NextResponse.json({ success: true, message: 'Door open command sent' });
    }

    if (action === 'rotate_secret') {
      // 重新生成secret key
      const actualScope = scope || 'main_door';
      const newSecret = crypto.randomBytes(32).toString('base64');

      const { error: updateError } = await supabase
        .from('door_secrets')
        .update({ secret_key: newSecret, updated_at: new Date().toISOString() })
        .eq('device_id', device_id)
        .eq('scope', actualScope);

      if (updateError) {
        console.error('[admin-override] rotate secret error:', updateError);
        return NextResponse.json({ error: 'Failed to rotate secret' }, { status: 500 });
      }

      // 插入rotate指令俾ESP32知要更新本地cache嘅password
      await supabase.from('door_commands').insert({
        device_id,
        command: JSON.stringify({
          action: 'secret_rotated',
          scope: actualScope,
        }),
        status: 'pending',
        created_by: user.id,
      });

      return NextResponse.json({
        success: true,
        message: 'Secret rotated successfully',
        scope: actualScope,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('[door/admin-override] error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
