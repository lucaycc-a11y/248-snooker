import { NextResponse } from 'next/server'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'
import { getAdminMonthlyReport, isMonth } from '@/lib/data/getAdminMonthlyReport'
import { analyseMonth, sanitizeAnalysis } from '@/lib/admin/monthlyAnalysis'
import { renderMonthlyPdf } from '@/lib/admin/monthlyPdf'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

// POST { month, analysis? } → the 月報 as a PDF. When the page already has Spark's analysis it sends it
// back so the PDF matches what the admin is looking at (and Spark is not called twice).
export const POST = withAdminSecurity(
  async (req) => {
    const body: unknown = await req.json().catch(() => null)
    const o = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
    const month = typeof o.month === 'string' && isMonth(o.month) ? o.month : undefined
    const data = await getAdminMonthlyReport({ month })
    const supplied = sanitizeAnalysis(o.analysis, o.analysis && typeof o.analysis === 'object' && (o.analysis as { source?: unknown }).source === 'spark' ? 'spark' : 'rules')
    const analysis = supplied && supplied.plan.length > 0 ? supplied : await analyseMonth(data)
    try {
      const pdf = await renderMonthlyPdf(data, analysis)
      return new NextResponse(new Uint8Array(pdf), {
        status: 200,
        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="Space8-monthly-report-${data.month}.pdf"`, 'Cache-Control': 'no-store' },
      })
    } catch (err) {
      console.error('[admin/monthly-pdf] render failed', err)
      return NextResponse.json({ error: 'PDF 產生失敗，請再試' }, { status: 500 })
    }
  },
  { rateLimit: { bucket: 'admin_monthly_pdf', max: 20, windowSeconds: 3600, identifierType: 'user' } },
)
