import { notFound } from 'next/navigation'
import { getServiceSupabase } from '@/lib/supabase/service'
import { Card } from '@/components/ui/Card'
import { tokens } from '@/app/styles/tokens'
import { num, str, type Row } from '@/lib/data/adminReadHelpers'
import MemberActions from '@/components/admin/MemberActions'
import MemberBookingCalendar from '@/components/admin/MemberBookingCalendar'
import BookingCancelAction from '@/components/admin/BookingCancelAction'

// Points/tier/blacklist writes (spec 3.2) live in MemberActions, calling
// app/api/admin/members/[id]/route.ts — every action requires a reason and
// is audit-logged.

async function getMemberDetail(id: string) {
  const service = getServiceSupabase()
  const { data } = await service
    .from('users')
    .select('id, member_code, email, display_name, phone, tier, points, is_blacklisted, created_at')
    .eq('id', id)
    .maybeSingle()
  if (!data) return null
  const user = data as Row

  let bookings: Row[] = []
  try {
    const { data: rows } = await service
      .from('bookings')
      .select('id, booking_reference, date, status, total_price, table_number')
      .eq('user_id', id)
      .order('date', { ascending: false })
      .limit(20)
    bookings = (rows ?? []) as Row[]
  } catch {
    /* stays empty */
  }

  let pointsLedger: Row[] = []
  try {
    const { data: rows } = await service
      .from('points_ledger')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(20)
    pointsLedger = (rows ?? []) as Row[]
  } catch {
    /* stays empty */
  }

  return { user, bookings, pointsLedger }
}

function Row_({ label, value, isCode }: { label: string; value: string; isCode?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${tokens.colors.border}` }}>
      <span style={{ color: tokens.colors.textMuted, fontSize: 14 }}>{label}</span>
      <span className={isCode ? 'font-code' : ''} style={{ color: tokens.colors.text, fontSize: 14 }}>{value}</span>
    </div>
  )
}

export default async function AdminMemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await getMemberDetail(id)
  if (!result) notFound()
  const { user, bookings, pointsLedger } = result

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.text, marginBottom: 24 }}>
        {str(user, ['display_name']) ?? str(user, ['email']) ?? id.slice(0, 8)}
        {user.is_blacklisted === true && (
          <span
            style={{
              marginLeft: 10,
              fontSize: 12,
              fontWeight: 700,
              color: tokens.colors.danger,
              border: `1px solid ${tokens.colors.danger}`,
              borderRadius: 4,
              padding: '2px 8px',
              verticalAlign: 'middle',
            }}
          >
            BLACKLISTED
          </span>
        )}
      </h1>

      <MemberActions userId={id} currentTier={str(user, ['tier']) ?? 'amateur'} isBlacklisted={user.is_blacklisted === true} />

      <Card style={{ marginBottom: tokens.spacing.lg }}>
        <Row_ label="Member code" value={str(user, ['member_code']) ?? '—'} isCode={true} />
        {str(user, ['email']) && <Row_ label="Email" value={str(user, ['email'])!} />}
        {str(user, ['phone']) && <Row_ label="Phone" value={str(user, ['phone'])!} />}
        <Row_ label="Tier" value={str(user, ['tier']) ?? 'amateur'} />
        <Row_ label="Points" value={String(num(user, ['points'], 0))} />
        <Row_ label="Joined" value={str(user, ['created_at']) ?? '—'} />
      </Card>

      <Card style={{ marginBottom: tokens.spacing.lg }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: tokens.colors.text, marginBottom: tokens.spacing.md }}>
          Booking calendar
        </div>
        <MemberBookingCalendar
          bookings={bookings
            .filter((b) => str(b, ['date']) !== null)
            .map((b) => ({ date: str(b, ['date'])!, status: str(b, ['status']) ?? 'pending' }))}
        />
      </Card>

      <Card style={{ marginBottom: tokens.spacing.lg }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: tokens.colors.text, marginBottom: tokens.spacing.md }}>
          Booking history
        </div>
        {bookings.length === 0 && (
          <div style={{ color: tokens.colors.textMuted, fontSize: 14 }}>No bookings yet.</div>
        )}
        {bookings.map((b) => {
          const status = str(b, ['status'])
          const canCancel = status !== 'refunded' && status !== 'admin_cancelled'
          return (
            <div
              key={String(b.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: tokens.spacing.sm,
                padding: '8px 0',
                borderBottom: `1px solid ${tokens.colors.border}`,
              }}
            >
              <div>
                <div style={{ color: tokens.colors.textMuted, fontSize: 14 }}>
                  {str(b, ['booking_reference']) ?? String(b.id).slice(0, 8)}
                </div>
                <div style={{ color: tokens.colors.text, fontSize: 14 }}>
                  {str(b, ['date']) ?? ''} · {status ?? ''} · HK${num(b, ['total_price'], 0)}
                </div>
              </div>
              {canCancel && <BookingCancelAction bookingId={String(b.id)} compact />}
            </div>
          )
        })}
      </Card>

      <Card>
        <div style={{ fontSize: 16, fontWeight: 700, color: tokens.colors.text, marginBottom: tokens.spacing.md }}>
          Points ledger
        </div>
        {pointsLedger.length === 0 && (
          <div style={{ color: tokens.colors.textMuted, fontSize: 14 }}>No points activity yet.</div>
        )}
        {pointsLedger.map((p, i) => (
          <Row_
            key={String(p.id ?? i)}
            label={str(p, ['note', 'type']) ?? 'Points'}
            value={`${num(p, ['points'], 0) > 0 ? '+' : ''}${num(p, ['points'], 0)}`}
          />
        ))}
      </Card>
    </main>
  )
}
