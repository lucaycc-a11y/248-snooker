/**
 * GET/POST /api/cron/monthly-report
 * 月報電郵. Runs daily (vercel.json) late evening HK time. It only does work on the last day of a month
 * (sends that month's report), or on the 1st if the previous month's report never went out (catch-up).
 * Auth is the same as the other cron routes. `?month=YYYY-MM&force=1` re-sends a specific month by hand.
 */
import { NextResponse } from 'next/server'
import { getAdminMonthlyReport, isMonth, prevMonthOf } from '@/lib/data/getAdminMonthlyReport'
import { analyseMonth } from '@/lib/admin/monthlyAnalysis'
import { sendMonthlyReportEmail } from '@/lib/admin/monthlyReportMail'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { hkNow, shiftDate } from '@/lib/admin/today'
import { logSiteError } from '@/lib/errors/log'

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

  const url = new URL(req.url)
  const force = url.searchParams.get('force') === '1'
  const asked = url.searchParams.get('month') ?? undefined
  const today = hkNow().date
  const isLastDay = shiftDate(today, 1).slice(0, 7) !== today.slice(0, 7)

  let month: string | null = null
  if (force && isMonth(asked)) month = asked
  else if (isLastDay) month = today.slice(0, 7)
  else if (today.endsWith('-01')) month = prevMonthOf(today.slice(0, 7)) // catch-up
  if (!month) return NextResponse.json({ skipped: 'not the last day of the month' })

  const db = getLegacyServiceSupabase()
  if (force) await db.from('admin_monthly_report_sends').delete().eq('month', month)
  const { error: claimErr } = await db.from('admin_monthly_report_sends').insert({ month, status: 'sending' })
  if (claimErr) {
    // 23505 = already claimed/sent for this month — that is the normal "nothing to do" path.
    if (claimErr.code === '23505') return NextResponse.json({ skipped: `${month} already handled` })
    await logSiteError('cron.monthly-report', 'error', '月報記錄寫入失敗', { message: claimErr.message })
    return NextResponse.json({ error: 'claim failed' }, { status: 500 })
  }

  try {
    const data = await getAdminMonthlyReport({ month })
    const analysis = await analyseMonth(data)
    const { recipients } = await sendMonthlyReportEmail(data, analysis)
    await db.from('admin_monthly_report_sends').update({ status: 'sent', recipient_count: recipients.length, sent_at: new Date().toISOString(), detail: analysis.source }).eq('month', month)
    return NextResponse.json({ ok: true, month, recipients: recipients.length, source: analysis.source })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[cron/monthly-report] failed', err)
    await logSiteError('cron.monthly-report', 'error', '月報電郵發送失敗', { month, message })
    // Release the claim so the next run (or a manual retry) can try again.
    await db.from('admin_monthly_report_sends').delete().eq('month', month)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
