/**
 * GET/POST /api/cron/payment-reconcile
 * Scheduler endpoint (header x-cron-secret = PAYMENT_RECONCILE_CRON_SECRET, or Vercel's
 * Authorization: Bearer <CRON_SECRET>). Closes out stale payment attempts by asking KPay.
 * Bookings that KPay reports as paid are confirmed unless PAYMENT_FREEZE_PUBLIC=false (kill switch);
 * in that case they are only reported (admin monitor shows them).
 */
import { NextResponse } from 'next/server'
import { reconcileStaleAttempts } from '@/lib/payments/reconcile'
import { isPaymentFreezePublic } from '@/lib/payments/freeze-flag'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function handle(req: Request) {
  const secret = process.env.PAYMENT_RECONCILE_CRON_SECRET
  const vercel = process.env.CRON_SECRET
  const supplied = req.headers.get('x-cron-secret')
  const bearer = req.headers.get('authorization')
  const ok =
    (secret && supplied === secret) || (vercel && bearer === `Bearer ${vercel}`)
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const items = await reconcileStaleAttempts({
    confirmPaid: isPaymentFreezePublic(),
    source: 'cron',
    limit: 60,
  })
  return NextResponse.json({ handled: items.length, items })
}

export const GET = handle
export const POST = handle
