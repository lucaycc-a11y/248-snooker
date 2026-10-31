/**
 * GET/POST /api/cron/violation-cases
 * Daily sweep for violation cases: one reminder ~24h before the due date, then one overdue notice.
 * Same auth as /api/cron/health-watch (x-cron-secret = PAYMENT_RECONCILE_CRON_SECRET, or Vercel's
 * Authorization: Bearer <CRON_SECRET>). It only emails and flags status — it never charges anyone
 * and never blacklists; escalation after overdue stays a human decision in /admin/cases.
 */
import { NextResponse } from 'next/server'
import { runCaseSweep } from '@/lib/cases/service'

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

  const result = await runCaseSweep()
  return NextResponse.json(result, { status: result.errors.length > 0 ? 207 : 200 })
}

export const GET = handle
export const POST = handle
