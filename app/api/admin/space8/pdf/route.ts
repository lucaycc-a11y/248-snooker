import { NextResponse } from 'next/server'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'
import { getAdminData } from '@/lib/data/getAdmin'
import { getSpace8Ledger } from '@/lib/data/getSpace8Ledger'
import { renderSpace8Pdf } from '@/lib/admin/space8Pdf'
import { hkNow } from '@/lib/admin/today'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

// POST → the SPACE8 費用帳 as a PDF (always the live data, so it matches the page).
export const POST = withAdminSecurity(
  async () => {
    const admin = await getAdminData()
    if (admin?.role !== 'super_admin') return NextResponse.json({ error: '只限 super admin' }, { status: 403 })
    try {
      const data = await getSpace8Ledger()
      const today = hkNow().date
      const pdf = await renderSpace8Pdf(data, today)
      return new NextResponse(new Uint8Array(pdf), {
        status: 200,
        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="SPACE8-expenses-${today}.pdf"`, 'Cache-Control': 'no-store' },
      })
    } catch (err) {
      console.error('[admin/space8-pdf] render failed', err)
      return NextResponse.json({ error: 'PDF 產生失敗，請再試' }, { status: 500 })
    }
  },
  { rateLimit: { bucket: 'admin_space8_pdf', max: 20, windowSeconds: 3600, identifierType: 'user' } },
)
