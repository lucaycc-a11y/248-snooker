/**
 * GET/POST /api/cron/health-watch
 * 自動巡檢. Scheduler endpoint, same auth as /api/cron/payment-reconcile
 * (header x-cron-secret = PAYMENT_RECONCILE_CRON_SECRET, or Vercel's
 * Authorization: Bearer <CRON_SECRET>). Read-only apart from admin_alerts bookkeeping and email.
 */
import { NextResponse } from 'next/server'
import { runHealthWatch } from '@/lib/admin/healthWatch'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

async function handle(req: Request) {
  const secret = process.env.PAYMENT_RECONCILE_CRON_SECRET
  const vercel = process.env.CRON_SECRET
  const supplied = req.headers.get('x-cron-secret')
  const bearer = req.headers.get('authorization')
  const ok = (secret && supplied === secret) || (vercel && bearer === `Bearer ${vercel}`)
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await runHealthWatch()
  return NextResponse.json(result, { status: result.errors.length > 0 ? 207 : 200 })
}

export const GET = handle
export const POST = handle
