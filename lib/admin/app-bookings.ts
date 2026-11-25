import { str, num, type Row } from '@/lib/data/adminReadHelpers'

export function hkToday(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

export function mapBooking(r: Row, user?: { display_name: string | null; phone: string | null } | null) {
  return {
    id: String(r.id ?? ''),
    humanCode: str(r, ['human_code', 'booking_reference']),
    date: str(r, ['date']),
    startTime: str(r, ['start_time']),
    endTime: str(r, ['end_time']),
    durationHours: num(r, ['duration_hours'], 0),
    tableNumber: num(r, ['table_number'], 0),
    status: str(r, ['status']) ?? 'unknown',
    totalPrice: num(r, ['total_price'], 0),
    paymentMethod: str(r, ['payment_method']),
    isTest: r.is_test === true,
    userName: user?.display_name ?? str(r, ['user_name']),
    userPhone: user?.phone ?? null,
    userEmail: str(r, ['user_email']),
    createdAt: str(r, ['created_at']),
  }
}
