import { NextResponse } from 'next/server'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'
import { searchMembers } from '@/lib/spark/members'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Member picker search (browser only — never sent to the AI). Name, email, phone or member code.
export const GET = withAdminSecurity(
  async (req) => {
    const q = new URL(req.url).searchParams.get('q') ?? ''
    try {
      return NextResponse.json({ members: await searchMembers(q, 8) })
    } catch {
      return NextResponse.json({ error: '搜尋會員失敗' }, { status: 500 })
    }
  },
  { rateLimit: { bucket: 'admin_spark_members', max: 60, windowSeconds: 60, identifierType: 'user' } },
)
