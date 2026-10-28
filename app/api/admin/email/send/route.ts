import { NextResponse } from 'next/server'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'
import { getResend } from '@/lib/resend/client'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { writeAdminAudit } from '@/lib/admin/audit'
import { ownerEmail } from '@/lib/admin/alertMail'
import { resolveAudience, type AudienceKind } from '@/lib/email-composer/audience'
import { personalise, renderDoc, sanitizeDoc, stripDangerousHtml } from '@/lib/email-composer/doc'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const FROM = 'Space8 <no-reply@space8.com.hk>'
const BATCH = 100

function isRec(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export const POST = withAdminSecurity(
  async (req, admin) => {
    const body: unknown = await req.json().catch(() => null)
    if (!isRec(body)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

    const kind = body.kind
    if (kind !== 'test' && kind !== 'members' && kind !== 'all') return NextResponse.json({ error: '收件人類型不正確' }, { status: 400 })

    const subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, 150) : ''
    if (!subject) return NextResponse.json({ error: '請填寫電郵標題' }, { status: 400 })

    let html: string
    if (typeof body.customHtml === 'string' && body.customHtml.trim() !== '') {
      if (body.customHtml.length > 400_000) return NextResponse.json({ error: 'HTML 太大' }, { status: 400 })
      html = stripDangerousHtml(body.customHtml)
    } else {
      const doc = sanitizeDoc(body.doc)
      if (!doc || doc.blocks.length === 0) return NextResponse.json({ error: '電郵內容是空的' }, { status: 400 })
      html = renderDoc({ ...doc, subject })
    }

    const codes = Array.isArray(body.codes) ? body.codes.filter((c): c is string => typeof c === 'string') : []
    const adminEmail = admin.email ?? ''
    const audience = await resolveAudience(kind as AudienceKind, { adminEmail, codes })
    if (audience.error) return NextResponse.json({ error: audience.error }, { status: 400 })
    const recipients = audience.recipients
    if (recipients.length === 0) return NextResponse.json({ error: '沒有可發送的收件人' }, { status: 400 })

    // Mass sends must be confirmed against the exact current head-count.
    if (kind === 'all' && body.confirmCount !== recipients.length) {
      return NextResponse.json({ error: `收件人人數已變為 ${recipients.length}，請重新確認`, count: recipients.length }, { status: 409 })
    }

    const resend = getResend()
    const replyTo = ownerEmail()
    const subjectLine = kind === 'test' ? `【測試】${subject}` : subject
    let sent = 0
    let failed = 0
    for (let i = 0; i < recipients.length; i += BATCH) {
      const chunk = recipients.slice(i, i + BATCH)
      try {
        const { error } = await resend.batch.send(
          chunk.map((r) => ({ from: FROM, to: [r.email], subject: subjectLine, html: personalise(html, { name: r.name }), replyTo })),
        )
        if (error) failed += chunk.length
        else sent += chunk.length
      } catch (err) {
        console.error('[admin/email/send] batch failed', err)
        failed += chunk.length
      }
    }

    const templateId = typeof body.templateId === 'string' && /^[0-9a-f-]{36}$/i.test(body.templateId) ? body.templateId : null
    const service = getLegacyServiceSupabase()
    const { data: log } = await service
      .from('admin_email_sends')
      .insert({ template_id: templateId, subject, audience_kind: kind, recipient_count: recipients.length, sent_count: sent, failed_count: failed, admin_email: adminEmail })
      .select('id')
      .single()
    try {
      await writeAdminAudit({
        adminUserId: admin.id,
        adminEmail,
        action: 'admin_email_sent',
        targetTable: 'admin_email_sends',
        targetId: log ? String((log as { id: unknown }).id) : 'unknown',
        beforeValue: null,
        afterValue: { kind, subject, recipients: recipients.length, sent, failed },
      })
    } catch (err) {
      console.error('[admin/email/send] audit failed', err)
    }

    if (sent === 0) return NextResponse.json({ error: '電郵發送失敗，請稍後再試', sent, failed }, { status: 502 })
    return NextResponse.json({ ok: true, sent, failed, total: recipients.length })
  },
  { rateLimit: { bucket: 'admin_email_send', max: 12, windowSeconds: 3600, identifierType: 'user' } },
)
