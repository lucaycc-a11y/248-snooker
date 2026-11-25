import { NextResponse } from 'next/server'
import { requireAppAdmin, jsonError, NO_STORE } from '@/lib/admin/app-guard'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { mapBooking } from '@/lib/admin/app-bookings'
import { num, str, type Row } from '@/lib/data/adminReadHelpers'

// GET /api/admin/app/bookings/:id — id (uuid) or human code.
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type UserRow = { display_name: string | null; phone: string | null; email: string | null; member_code: string | null }
const CODE = /^[A-Za-z0-9_-]{3,40}$/

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const g = await requireAppAdmin(req)
  if (!g.ok) return g.res

  const key = params.id
  if (!UUID.test(key) && !CODE.test(key)) return jsonError('Invalid id')
  const db = getLegacyServiceSupabase()
  const { data, error } = await db
    .from('bookings')
    .select('*')
    .or(UUID.test(key) ? `id.eq.${key}` : `human_code.eq.${key},booking_reference.eq.${key}`)
    .limit(1)
    .maybeSingle()
  if (error) return jsonError('Could not load booking', 500)
  if (!data) return jsonError('Not found', 404)
  const r = data as Row

  let user: UserRow | null = null
  if (typeof r.user_id === 'string') {
    const { data: u } = await db.from('users').select('display_name, phone, email, member_code').eq('id', r.user_id).maybeSingle()
    user = (u as UserRow | null) ?? null
  }

  return NextResponse.json(
    {
      ...mapBooking(r, user),
      memberCode: user?.member_code ?? str(r, ['member_code']),
      adminNote: str(r, ['admin_note']),
      cancellationReason: str(r, ['cancellation_reason']),
      promoCode: str(r, ['promo_code']),
      discounts: {
        promo: num(r, ['promo_discount'], 0),
        credit: num(r, ['credit_discount'], 0),
        points: num(r, ['points_discount'], 0),
      },
      refundAmount: num(r, ['refund_amount'], 0),
      refundedAt: str(r, ['refunded_at']),
      confirmationEmailSentAt: str(r, ['confirmation_email_sent_at']),
    },
    { headers: NO_STORE },
  )
}
