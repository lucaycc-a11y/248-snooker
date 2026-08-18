import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { BOOKING_QR_ENTRY_LEAD_MINUTES } from '@/lib/door/access-window';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DOOR_API_KEY = process.env.DOOR_API_KEY!;

async function logAccess(
  device_id: string,
  method: string,
  identifier: string,
  result: string,
  reason: string | null
) {
  await supabase.from('door_access_log').insert({
    device_id,
    method,
    identifier,
    result,
    reason,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { api_key, code, device_id } = await req.json();

    // ---- 1. 驗證device api key ----
    if (api_key !== DOOR_API_KEY) {
      return NextResponse.json({ success: false, reason: 'invalid_api_key' }, { status: 401 });
    }

    if (!code) {
      return NextResponse.json({ success: false, reason: 'missing_code' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // ---- 2. Check if admin QR (格式: SPACE8-ADMIN-xxxx) ----
    if (code.startsWith('SPACE8-ADMIN-')) {
      const { data: admin, error } = await supabase
        .from('admin_users')
        .select('id, invite_status, admin_qr_generated_at')
        .eq('admin_qr_code', code)
        .single();

      if (error || !admin || admin.invite_status !== 'active') {
        await logAccess(device_id, 'qr_admin', code, 'denied', 'admin_not_found_or_inactive');
        return NextResponse.json({ success: false, reason: 'admin_qr_invalid' });
      }

      // Check 24-hour expiry
      const generatedAt = new Date(admin.admin_qr_generated_at).getTime();
      const nowTime = Date.now();
      if (nowTime - generatedAt > 24 * 60 * 60 * 1000) {
        await logAccess(device_id, 'qr_admin', code, 'denied', 'admin_qr_expired');
        return NextResponse.json({ success: false, reason: 'admin_qr_expired' });
      }

      await logAccess(device_id, 'qr_admin', code, 'success', null);

      return NextResponse.json({
        success: true,
        type: 'admin',
        tables: [], // Admin唔開場地relay,只開大門
      });
    }

    // ---- 3. 判斷係 booking code 定 member code ----
    const isBookingCode = code.startsWith('SPACE8-') && !code.includes('-C');

    if (isBookingCode) {
      // ------- Booking QR -------
      const { data: booking, error } = await supabase
        .from('bookings')
        .select('id, start_time, end_time, status')
        .eq('qr_code', code)
        .single();

      if (error || !booking) {
        await logAccess(device_id, 'qr_booking', code, 'denied', 'not_found');
        return NextResponse.json({ success: false, reason: 'booking_not_found' });
      }

      const startTime = new Date(booking.start_time).getTime();
      const endTime = new Date(booking.end_time).getTime();
      const nowTime = new Date(now).getTime();

      const isActive =
        booking.status === 'confirmed' &&
        nowTime >= startTime - BOOKING_QR_ENTRY_LEAD_MINUTES * 60 * 1000 && // 提前5分鐘可入
        nowTime <= endTime;

      if (!isActive) {
        await logAccess(device_id, 'qr_booking', code, 'denied', 'not_in_time_window');
        return NextResponse.json({
          success: false,
          reason: 'not_in_time_window',
          booking_start: booking.start_time,
          booking_end: booking.end_time,
        });
      }

      // 查詢呢個booking訂咗邊啲場
      const { data: bookingTables } = await supabase
        .from('booking_tables')
        .select('table_number')
        .eq('booking_id', booking.id);

      const tables = bookingTables?.map((t) => t.table_number) || [];

      await logAccess(device_id, 'qr_booking', code, 'success', null);

      return NextResponse.json({
        success: true,
        type: 'booking',
        tables,
        start_time: booking.start_time,
        end_time: booking.end_time,
      });
    } else {
      // ------- Member QR -------
      const { data: member, error } = await supabase
        .from('members')
        .select('id, member_code, tier, status')
        .eq('member_code', code)
        .single();

      if (error || !member) {
        await logAccess(device_id, 'qr_member', code, 'denied', 'not_found');
        return NextResponse.json({ success: false, reason: 'member_not_found' });
      }

      if (member.status !== 'active') {
        await logAccess(device_id, 'qr_member', code, 'denied', 'member_inactive');
        return NextResponse.json({ success: false, reason: 'member_inactive' });
      }

      // 檢查呢個member而家有冇生效緊嘅booking
      const { data: activeBooking } = await supabase
        .from('bookings')
        .select('id, start_time, end_time')
        .eq('member_id', member.id)
        .eq('status', 'confirmed')
        .lte('start_time', now)
        .gte('end_time', now)
        .maybeSingle();

      let tables: number[] = [];
      if (activeBooking) {
        const { data: bookingTables } = await supabase
          .from('booking_tables')
          .select('table_number')
          .eq('booking_id', activeBooking.id);

        tables = bookingTables?.map((t) => t.table_number) || [];
      }

      await logAccess(device_id, 'qr_member', code, 'success', null);

      return NextResponse.json({
        success: true,
        type: 'member',
        tier: member.tier,
        has_active_booking: !!activeBooking,
        tables,
      });
    }
  } catch (err) {
    console.error('[door/validate-qr] error:', err);
    return NextResponse.json({ success: false, reason: 'server_error' }, { status: 500 });
  }
}
