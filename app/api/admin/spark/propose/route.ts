import { NextResponse } from 'next/server'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'
import { isActionKind, proposeAction } from '@/lib/spark/actions'

// Proposal from a form in the chat (no AI involved). Same validation and limits as the AI path;
// it still only creates a pending card — the admin must press 確認 for anything to change.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const asRec = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

export const POST = withAdminSecurity(
  async (req, admin) => {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: '資料格式不正確' }, { status: 400 })
    }
    const f = asRec(body)
    if (!isActionKind(f.kind)) return NextResponse.json({ error: '不支援的操作' }, { status: 400 })
    const chatId = typeof f.chatId === 'string' ? f.chatId : null
    const res = await proposeAction(f.kind, asRec(f.args), { adminId: admin.id, adminEmail: admin.email ?? 'unknown', chatId, messageId: null })
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 422 })
    return NextResponse.json({ action: res.action })
  },
  { rateLimit: { bucket: 'admin_spark_propose', max: 20, windowSeconds: 60, identifierType: 'user' } },
)
