import { NextResponse } from 'next/server'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'
import { getAdminMonthlyReport, isMonth } from '@/lib/data/getAdminMonthlyReport'
import { analyseMonth, sanitizeAnalysis } from '@/lib/admin/monthlyAnalysis'
import { renderMonthlyPdf } from '@/lib/admin/monthlyPdf'
import { buildMonthlyReportEmail } from '@/lib/admin/monthlyReportMail'
import { ADMIN_ALERT_FROM } from '@/lib/admin/alertMail'
import { getResend } from '@/lib/resend/client'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

// POST { month?, analysis? } → emails the real 月報 (HTML design + PDF) to the requesting admin ONLY.
// The scheduled send to every admin stays in /api/cron/monthly-report.
export const POST = withAdminSecurity(
  async (req, admin) => {
    if (!admin.email) return NextResponse.json({ error: '找不到你的電郵' }, { status: 400 })
    const body: unknown = await req.json().catch(() => null)
    const o = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
    const month = typeof o.month === 'string' && isMonth(o.month) ? o.month : undefined
    const data = await getAdminMonthlyReport({ month })
    const supplied = sanitizeAnalysis(o.analysis, o.analysis && typeof o.analysis === 'object' && (o.analysis as { source?: unknown }).source === 'spark' ? 'spark' : 'rules')
    const analysis = supplied && supplied.plan.length > 0 ? supplied : await analyseMonth(data)
    try {
      const pdf = await renderMonthlyPdf(data, analysis)
      const mail = buildMonthlyReportEmail(data, analysis)
      const { error } = await getResend().emails.send({
        from: ADMIN_ALERT_FROM,
        to: [admin.email],
        subject: `【預覽】${mail.subject}`,
        html: mail.html,
        text: mail.text,
        attachments: [{ filename: `Space8-monthly-report-${data.month}.pdf`, content: pdf }],
      })
      if (error) return NextResponse.json({ error: `電郵發送失敗：${error.message}` }, { status: 502 })
      return NextResponse.json({ ok: true, to: admin.email })
    } catch (err) {
      console.error('[admin/monthly-send] failed', err)
      return NextResponse.json({ error: '月報電郵產生失敗，請再試' }, { status: 500 })
    }
  },
  { rateLimit: { bucket: 'admin_monthly_send', max: 5, windowSeconds: 3600, identifierType: 'user' } },
)
