import { NextResponse } from 'next/server'
import { requireAppAdmin, jsonError, NO_STORE } from '@/lib/admin/app-guard'
import { getMemberDetail } from '@/lib/data/getAdminMemberDetail'
import { getHiddenUserList } from '@/lib/data/getHiddenUserIds'
import { num, str } from '@/lib/data/adminReadHelpers'

// GET /api/admin/app/members/:id — same data as the web member page (read-only):
// profile, last 50 real bookings, last 50 points entries, last 20 audit rows, risk stats, hidden flag.
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const g = await requireAppAdmin(req)
  if (!g.ok) return g.res
  if (!UUID.test(params.id)) return jsonError('Invalid id')

  let detail: Awaited<ReturnType<typeof getMemberDetail>>
  try {
    detail = await getMemberDetail(params.id)
  } catch (err) {
    console.error('[admin/app/members/:id] load failed', err)
    return jsonError('Could not load member', 500)
  }
  if (!detail) return jsonError('Not found', 404)

  let hiddenReason: string | null = null
  let isHidden = false
  try {
    const hidden = await getHiddenUserList()
    isHidden = hidden.ids.has(params.id)
    hiddenReason = hidden.reasons.get(params.id) ?? null
  } catch (err) {
    console.error('[admin/app/members/:id] hidden list failed', err)
    return jsonError('Could not load hidden accounts', 500)
  }

  const u = detail.user
  return NextResponse.json(
    {
      member: {
        id: params.id,
        memberCode: str(u, ['member_code']),
        email: str(u, ['email']),
        displayName: str(u, ['display_name']),
        phone: str(u, ['phone']),
        tier: str(u, ['tier']) ?? 'amateur',
        points: num(u, ['points'], 0),
        isBlacklisted: u.is_blacklisted === true,
        isHidden,
        hiddenReason,
        createdAt: str(u, ['created_at']),
      },
      bookings: detail.bookings.map((b) => ({
        id: String(b.id ?? ''),
        humanCode: str(b, ['human_code', 'booking_reference']),
        date: str(b, ['date']),
        status: str(b, ['status']) ?? 'unknown',
        totalPrice: num(b, ['total_price'], 0),
        tableNumber: num(b, ['table_number'], 0),
      })),
      pointsLedger: detail.pointsLedger.map((p) => ({
        id: String(p.id ?? ''),
        points: num(p, ['points'], 0),
        type: str(p, ['type']),
        note: str(p, ['note']),
        createdAt: str(p, ['created_at']),
      })),
      activity: detail.activity.map((a) => ({
        action: str(a, ['action']),
        before: a.before_value ?? null,
        after: a.after_value ?? null,
        createdAt: str(a, ['created_at']),
      })),
      riskStats: detail.riskStats,
    },
    { headers: NO_STORE },
  )
}
