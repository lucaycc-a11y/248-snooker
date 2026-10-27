import { NextResponse } from 'next/server'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { actionView, type SparkActionRow } from '@/lib/spark/actions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const asRec = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

export const GET = withAdminSecurity(async (_req, admin, context) => {
  const id = context?.params.id ?? ''
  const svc = getLegacyServiceSupabase()
  const { data: chat } = await svc.from('admin_spark_chats').select('id, title').eq('id', id).eq('admin_user_id', admin.id).maybeSingle()
  if (!chat) return NextResponse.json({ error: '找不到這個對話' }, { status: 404 })
  const { data: msgs } = await svc.from('admin_spark_messages').select('id, role, content, blocks, steps, created_at').eq('chat_id', id).order('created_at', { ascending: true })
  const { data: acts } = await svc.from('admin_spark_actions').select('*').eq('chat_id', id)
  const fresh = new Map(((acts ?? []) as SparkActionRow[]).map((a) => [a.id, actionView(a)]))

  // Action cards are stored as they were proposed; show their live status instead.
  const messages = ((msgs ?? []) as Record<string, unknown>[]).map((m) => ({
    ...m,
    blocks: (Array.isArray(m.blocks) ? m.blocks : []).map((b: unknown) => {
      const r = asRec(b)
      if (r.type !== 'action') return b
      const old = asRec(r.action)
      const live = typeof old.id === 'string' ? fresh.get(old.id) : undefined
      return live ? { type: 'action', action: live } : b
    }),
  }))
  return NextResponse.json({ chat, messages })
})

export const DELETE = withAdminSecurity(async (_req, admin, context) => {
  const id = context?.params.id ?? ''
  const { error } = await getLegacyServiceSupabase().from('admin_spark_chats').delete().eq('id', id).eq('admin_user_id', admin.id)
  if (error) return NextResponse.json({ error: '刪除失敗' }, { status: 500 })
  return NextResponse.json({ ok: true })
})
