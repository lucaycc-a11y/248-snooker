import { NextResponse } from 'next/server'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { sanitizeDoc, stripDangerousHtml } from '@/lib/email-composer/doc'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withAdminSecurity(async () => {
  const { data, error } = await getLegacyServiceSupabase()
    .from('admin_email_templates')
    .select('id, name, subject, doc, custom_html, updated_at')
    .order('updated_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: '載入範本失敗' }, { status: 500 })
  return NextResponse.json({ templates: data ?? [] })
}, { csrf: false })

// Create (no id) or update (id) a template.
export const POST = withAdminSecurity(async (req, admin) => {
  const body: unknown = await req.json().catch(() => null)
  if (typeof body !== 'object' || body === null) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const b = body as Record<string, unknown>
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, 80) : ''
  if (!name) return NextResponse.json({ error: '請填寫範本名稱' }, { status: 400 })
  const doc = sanitizeDoc(b.doc)
  if (!doc) return NextResponse.json({ error: '內容格式不正確' }, { status: 400 })
  const customHtml = typeof b.customHtml === 'string' && b.customHtml.trim() !== '' ? stripDangerousHtml(b.customHtml).slice(0, 400_000) : null
  const row = { name, subject: doc.subject, doc, custom_html: customHtml, updated_at: new Date().toISOString() }
  const service = getLegacyServiceSupabase()
  const id = typeof b.id === 'string' && /^[0-9a-f-]{36}$/i.test(b.id) ? b.id : null
  const q = id
    ? service.from('admin_email_templates').update(row).eq('id', id).select('id').single()
    : service.from('admin_email_templates').insert({ ...row, created_by_email: admin.email ?? null }).select('id').single()
  const { data, error } = await q
  if (error || !data) return NextResponse.json({ error: '儲存範本失敗' }, { status: 500 })
  return NextResponse.json({ ok: true, id: String((data as { id: unknown }).id) })
}, { rateLimit: { bucket: 'admin_email_template', max: 60, windowSeconds: 3600, identifierType: 'user' } })
