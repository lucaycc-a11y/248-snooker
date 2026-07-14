import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

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

    const now = new Date().toISOString();

    // 攞返而家生效緊嘅全部booking(start_time - 5分鐘 <= now <= end_time)
    const { data: activeBookings, error } = await supabase
      .from('bookings')
      .select('id, start_time, end_time')
      .eq('status', 'confirmed')
      .lte('start_time', now)
      .gte('end_time', now);

    if (error) {
      console.error('[active-bookings-cache] query error:', error);
      return NextResponse.json({ success: false, reason: 'query_error' }, { status: 500 });
    }

    const bookingsWithTables = await Promise.all(
      (activeBookings || []).map(async (booking) => {
        const { data: bookingTables } = await supabase
          .from('booking_tables')
          .select('table_number')
          .eq('booking_id', booking.id);

        return {
          booking_id: booking.id,
          tables: bookingTables?.map((t) => t.table_number) || [],
          start_time: booking.start_time,
          end_time: booking.end_time,
        };
      })
    );

    return NextResponse.json({
      success: true,
      active_bookings: bookingsWithTables,
      cached_at: now,
    });
  } catch (err) {
    console.error('[active-bookings-cache] error:', err);
    return NextResponse.json({ success: false, reason: 'server_error' }, { status: 500 });
  }
}
