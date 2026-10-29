/**
 * POST /api/admin/bookings/[id]/review  { decision: 'confirm' | 'refunded', note? }
 * Resolves a payment_review booking (paid, but not auto-confirmable). See lib/payments/review.ts.
 */
import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'
import { resolvePaymentReview } from '@/lib/payments/review'
import { writeAdminActionLog } from '@/lib/admin/audit'

export const runtime = 'nodejs'

async function handle(req: Request, _admin: { id: string; email?: string }, context?: { params: Record<string, string> }) {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 })
  const bookingId = context?.params?.id
  if (!bookingId) return NextResponse.json({ error: '預約編號無效' }, { status: 400 })

  const body = (await req.json().catch(() => null)) as { decision?: unknown; note?: unknown } | null
  if (body?.decision !== 'confirm' && body?.decision !== 'refunded') return NextResponse.json({ error: '請選擇處理方式' }, { status: 400 })
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : ''
  if (note.length < 3) return NextResponse.json({ error: '請填寫備註（至少 3 個字）' }, { status: 400 })

  const result = await resolvePaymentReview({ bookingId, decision: body.decision, note, adminEmail: admin.email })
  try {
    await writeAdminActionLog({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      actionType: 'payment_review_resolve',
      targetTable: 'bookings',
      targetId: bookingId,
      afterJsonb: { decision: body.decision, ok: result.ok, note },
    })
  } catch {
    /* audit is best-effort */
  }
  if (!result.ok) return NextResponse.json({ error: result.message, reason: result.reason }, { status: result.reason === 'not_found' ? 404 : 409 })
  return NextResponse.json({ ok: true, outcome: result.outcome })
}

export const POST = withAdminSecurity(handle, { rateLimit: { bucket: 'admin_payment_review', max: 20, windowSeconds: 60 } })
