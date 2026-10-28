import { NextResponse } from 'next/server'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'
import { resolveAudience, type AudienceKind } from '@/lib/email-composer/audience'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// How many people a send would reach. Counts only — addresses never leave the server.
export const GET = withAdminSecurity(async (req, admin) => {
  const url = new URL(req.url)
  const kind = url.searchParams.get('kind')
  if (kind !== 'test' && kind !== 'members' && kind !== 'all') {
    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 })
  }
  const codes = (url.searchParams.get('codes') ?? '').split(',').filter(Boolean)
  const r = await resolveAudience(kind as AudienceKind, { adminEmail: admin.email ?? '', codes })
  if (r.error) return NextResponse.json({ error: r.error }, { status: 400 })
  return NextResponse.json({ count: r.recipients.length })
}, { csrf: false })
