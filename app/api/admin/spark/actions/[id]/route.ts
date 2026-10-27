import { NextResponse } from 'next/server'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'
import { confirmAction, redoAction, rejectAction, undoAction } from '@/lib/spark/actions'

// The only door through which a Spark proposal becomes a real change.
// Body: { op: 'confirm' | 'reject' | 'undo' | 'redo' }. Only the admin who asked may act on it.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export const POST = withAdminSecurity(
  async (req, admin, context) => {
    const id = context?.params.id ?? ''
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: '資料格式不正確' }, { status: 400 })
    }
    const op = typeof body === 'object' && body !== null ? (body as { op?: unknown }).op : undefined
    const ctx = { adminId: admin.id, adminEmail: admin.email ?? 'unknown', chatId: null, messageId: null }
    const res =
      op === 'confirm' ? await confirmAction(id, ctx)
      : op === 'reject' ? await rejectAction(id, ctx)
      : op === 'undo' ? await undoAction(id, ctx)
      : op === 'redo' ? await redoAction(id, ctx)
      : null
    if (!res) return NextResponse.json({ error: '不支援的操作' }, { status: 400 })
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
    return NextResponse.json({ action: res.action })
  },
  { rateLimit: { bucket: 'admin_spark_action', max: 20, windowSeconds: 60, identifierType: 'user' } },
)
