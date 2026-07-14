import { notFound } from 'next/navigation'
import { getServiceSupabase } from '@/lib/supabase/service'
import { Card } from '@/components/ui/Card'
import { tokens } from '@/app/styles/tokens'
import { num, str, type Row } from '@/lib/data/adminReadHelpers'
import BookingCancelAction from '@/components/admin/BookingCancelAction'

// Manual refund is handled by the existing member self-serve flow / a
// separate refund route — this admin action is a distinct soft-cancel
// (status='admin_cancelled') for no-payment-to-reverse cases, per spec 3.1.

async function getBookingDetail(id: string) {
  const service = getServiceSupabase()
  const { data } = await service.from('bookings').select('*').eq('id', id).maybeSingle()
  if (!data) return null
  const booking = data as Row

  let user: { email: string | null; display_name: string | null; phone: string | null } | null = null
  if (typeof booking.user_id === 'string') {
    const { data: userRow } = await service
      .from('users')
      .select('email, display_name, phone')
      .eq('id', booking.user_id)
      .maybeSingle()
    if (userRow) {
      const u = userRow as Row
      user = { email: str(u, ['email']), display_name: str(u, ['display_name']), phone: str(u, ['phone']) }
    }
  }

  let otherBookings: Row[] = []
  if (typeof booking.user_id === 'string') {
    try {
      const { data: rows } = await service
        .from('bookings')
        .select('id, booking_reference, date, status, total_price')
        .eq('user_id', booking.user_id)
        .neq('id', id)
        .order('date', { ascending: false })
        .limit(10)
      otherBookings = (rows ?? []) as Row[]
    } catch {
      /* stays empty */
    }
  }

  return { booking, user, otherBookings }
}

function Row_({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${tokens.colors.border}` }}>
      <span style={{ color: tokens.colors.textMuted, fontSize: 14 }}>{label}</span>
      <span style={{ color: tokens.colors.text, fontSize: 14 }}>{value}</span>
    </div>
  )
}

export default async function AdminBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await getBookingDetail(id)
  if (!result) notFound()
  const { booking, user, otherBookings } = result

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.text, marginBottom: 24 }}>
        {str(booking, ['booking_reference']) ?? id.slice(0, 8)}
      </h1>

      {str(booking, ['status']) !== 'refunded' && str(booking, ['status']) !== 'admin_cancelled' && (
        <BookingCancelAction bookingId={id} />
      )}

      <Card style={{ marginBottom: tokens.spacing.lg }}>
        <Row_ label="Customer" value={user?.display_name ?? user?.email ?? 'Guest'} />
        {user?.email && <Row_ label="Email" value={user.email} />}
        {user?.phone && <Row_ label="Phone" value={user.phone} />}
        <Row_ label="Table" value={String(num(booking, ['table_number'], 0))} />
        <Row_
          label="Date / time"
          value={`${str(booking, ['date']) ?? ''} ${str(booking, ['start_time']) ?? ''}-${str(booking, ['end_time']) ?? ''}`}
        />
        <Row_ label="Price" value={`HK$${num(booking, ['total_price'], 0)}`} />
        <Row_ label="Status" value={str(booking, ['status']) ?? 'unknown'} />
        <Row_ label="Payment method" value={str(booking, ['payment_method']) ?? '—'} />
        {num(booking, ['refund_amount'], 0) > 0 && (
          <Row_ label="Refund amount" value={`HK$${num(booking, ['refund_amount'], 0)}`} />
        )}
      </Card>

      {otherBookings.length > 0 && (
        <Card>
          <div style={{ fontSize: 16, fontWeight: 700, color: tokens.colors.text, marginBottom: tokens.spacing.md }}>
            Other bookings by this customer
          </div>
          {otherBookings.map((b) => (
            <Row_
              key={String(b.id)}
              label={str(b, ['booking_reference']) ?? String(b.id).slice(0, 8)}
              value={`${str(b, ['date']) ?? ''} · ${str(b, ['status']) ?? ''} · HK$${num(b, ['total_price'], 0)}`}
            />
          ))}
        </Card>
      )}
    </main>
  )
}
