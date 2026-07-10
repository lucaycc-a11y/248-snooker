import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DOOR_API_KEY = process.env.DOOR_API_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { api_key, uid, device_id } = await req.json();

    if (api_key !== DOOR_API_KEY) {
      return NextResponse.json({ success: false, reason: 'invalid_api_key' }, { status: 401 });
    }

    if (!uid) {
      return NextResponse.json({ success: false, reason: 'missing_uid' }, { status: 400 });
    }

    const { data: card, error } = await supabase
      .from('staff_nfc_cards')
      .select('id, card_label, status, admin_user_id')
      .eq('nfc_uid', uid)
      .single();

    if (error || !card || card.status !== 'active') {
      await supabase.from('door_access_log').insert({
        device_id,
        method: 'nfc',
        identifier: uid,
        result: 'denied',
        reason: !card ? 'not_registered' : 'card_disabled',
      });
      return NextResponse.json({ success: false, reason: 'unauthorized_card' });
    }

    // 更新最後使用時間
    await supabase
      .from('staff_nfc_cards')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', card.id);

    await supabase.from('door_access_log').insert({
      device_id,
      method: 'nfc',
      identifier: uid,
      result: 'success',
      reason: null,
    });

    return NextResponse.json({
      success: true,
      type: 'admin_override',
      label: card.card_label,
      tables: [], // Admin NFC唔開場地relay,只開大門
    });
  } catch (err) {
    console.error('[door/validate-nfc] error:', err);
    return NextResponse.json({ success: false, reason: 'server_error' }, { status: 500 });
  }
}
