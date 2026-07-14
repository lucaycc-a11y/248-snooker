import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DOOR_API_KEY = process.env.DOOR_API_KEY!;
const MAX_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15分鐘

function generatePassword(secret: string, timeWindow: number): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(String(timeWindow));
  const hash = hmac.digest();

  let password = '';
  for (let i = 0; i < 6; i++) {
    const digit = hash[i] % 10;
    password += digit;
  }
  return password;
}

export async function POST(req: NextRequest) {
  try {
    const { api_key, device_id, password, scope } = await req.json();

    if (api_key !== DOOR_API_KEY) {
      return NextResponse.json({ success: false, reason: 'invalid_api_key' }, { status: 401 });
    }

    if (!password || !device_id) {
      return NextResponse.json({ success: false, reason: 'missing_params' }, { status: 400 });
    }

    const actualScope = scope || 'main_door';

    // 1. 檢查lockout狀態
    const { data: lockoutRecord } = await supabase
      .from('door_lockouts')
      .select('locked_until, attempt_count')
      .eq('device_id', device_id)
      .eq('scope', actualScope)
      .maybeSingle();

    if (lockoutRecord?.locked_until) {
      const lockedUntil = new Date(lockoutRecord.locked_until).getTime();
      const now = Date.now();

      if (now < lockedUntil) {
        await supabase.from('door_access_log').insert({
          device_id,
          method: 'keypad',
          identifier: password.substring(0, 2) + '****',
          result: 'denied',
          reason: 'locked_out',
        });

        return NextResponse.json({
          success: false,
          reason: 'locked_out',
          locked_until: lockoutRecord.locked_until,
        });
      } else {
        // lockout過期,重置
        await supabase
          .from('door_lockouts')
          .delete()
          .eq('device_id', device_id)
          .eq('scope', actualScope);
      }
    }

    // 2. 攞secret
    const { data: secret, error } = await supabase
      .from('door_secrets')
      .select('secret_key')
      .eq('device_id', device_id)
      .eq('scope', actualScope)
      .single();

    if (error || !secret) {
      return NextResponse.json({ success: false, reason: 'secret_not_found' }, { status: 404 });
    }

    // 3. 驗證password（容許當前window同前一個window,防時間差）
    const currentWindow = Math.floor(Date.now() / 1000 / 3600);
    const currentPassword = generatePassword(secret.secret_key, currentWindow);
    const previousPassword = generatePassword(secret.secret_key, currentWindow - 1);

    const isValid = password === currentPassword || password === previousPassword;

    if (isValid) {
      // 成功,清除lockout記錄
      await supabase
        .from('door_lockouts')
        .delete()
        .eq('device_id', device_id)
        .eq('scope', actualScope);

      await supabase.from('door_access_log').insert({
        device_id,
        method: 'keypad',
        identifier: password.substring(0, 2) + '****',
        result: 'success',
        reason: null,
      });

      return NextResponse.json({
        success: true,
        scope: actualScope,
      });
    } else {
      // 失敗,累積attempt
      const currentAttempts = (lockoutRecord?.attempt_count || 0) + 1;

      if (currentAttempts >= MAX_ATTEMPTS) {
        // 觸發lockout
        const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();

        await supabase.from('door_lockouts').upsert(
          {
            device_id,
            scope: actualScope,
            locked_until: lockedUntil,
            attempt_count: currentAttempts,
          },
          { onConflict: 'device_id,scope' }
        );

        await supabase.from('door_access_log').insert({
          device_id,
          method: 'keypad',
          identifier: password.substring(0, 2) + '****',
          result: 'denied',
          reason: 'max_attempts_reached',
        });

        return NextResponse.json({
          success: false,
          reason: 'max_attempts_reached',
          locked_until: lockedUntil,
        });
      } else {
        // 未到limit,記錄attempt
        await supabase.from('door_lockouts').upsert(
          {
            device_id,
            scope: actualScope,
            attempt_count: currentAttempts,
            locked_until: null,
          },
          { onConflict: 'device_id,scope' }
        );

        await supabase.from('door_access_log').insert({
          device_id,
          method: 'keypad',
          identifier: password.substring(0, 2) + '****',
          result: 'denied',
          reason: 'invalid_password',
        });

        return NextResponse.json({
          success: false,
          reason: 'invalid_password',
          attempts_left: MAX_ATTEMPTS - currentAttempts,
        });
      }
    }
  } catch (err) {
    console.error('[door/validate-password] error:', err);
    return NextResponse.json({ success: false, reason: 'server_error' }, { status: 500 });
  }
}
