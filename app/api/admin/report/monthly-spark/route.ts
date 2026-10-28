import { NextResponse } from 'next/server'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'
import { getAdminMonthlyReport, isMonth } from '@/lib/data/getAdminMonthlyReport'
import { analyseMonth } from '@/lib/admin/monthlyAnalysis'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export const POST = withAdminSecurity(
  async (req) => {
    const body: unknown = await req.json().catch(() => null)
    const m = typeof body === 'object' && body !== null && 'month' in body ? String((body as { month: unknown }).month) : undefined
    const data = await getAdminMonthlyReport({ month: isMonth(m) ? m : undefined })
    return NextResponse.json(await analyseMonth(data))
  },
  { rateLimit: { bucket: 'admin_monthly_spark', max: 15, windowSeconds: 3600, identifierType: 'user' } },
)
