import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DOOR_API_KEY = process.env.DOOR_API_KEY!;

function generatePassword(secret: string, timeWindow: number): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(String(timeWindow));
  const hash = hmac.digest();

  let password = '';
  for (let i = 0; i < 6; i++) {
    const digit = hash[i] % 10; // 0-9
    password += digit;
  }
  return password;
}

export async function POST(req: NextRequest) {
  try {
    const { api_key, device_id, scope } = await req.json();

    if (api_key !== DOOR_API_KEY) {
      return NextResponse.json({ success: false, reason: 'invalid_api_key' }, { status: 401 });
    }

    const actualScope = scope || 'main_door'; // default大門

    const { data: secret, error } = await supabase
      .from('door_secrets')
      .select('secret_key')
      .eq('device_id', device_id)
      .eq('scope', actualScope)
      .single();

    if (error || !secret) {
      return NextResponse.json({ success: false, reason: 'secret_not_found' }, { status: 404 });
    }

    const timeWindow = Math.floor(Date.now() / 1000 / 3600); // 每小時一個window
    const password = generatePassword(secret.secret_key, timeWindow);

    return NextResponse.json({
      success: true,
      password,
      scope: actualScope,
      time_window: timeWindow,
      valid_until: (timeWindow + 1) * 3600 * 1000,
    });
  } catch (err) {
    console.error('[door/backup-password] error:', err);
    return NextResponse.json({ success: false, reason: 'server_error' }, { status: 500 });
  }
}
