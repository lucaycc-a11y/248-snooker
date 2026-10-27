import { NextResponse } from 'next/server'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { str, type Row } from '@/lib/data/adminReadHelpers'
import { adminMailShell, escapeHtml, sendAdminMail, type AdminMailAttachment } from '@/lib/admin/alertMail'

// 問題回報 — admin only. Stores the report, then emails the owner with the page, device
// and the latest site errors attached so the bug can be reproduced without asking.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SEVERITIES = ['urgent', 'annoying', 'idea'] as const
type Severity = (typeof SEVERITIES)[number]
const SEVERITY_LABEL: Record<Severity, string> = { urgent: '影響營業', annoying: '不便', idea: '建議' }
const MAX_PER_HOUR = 5
const SHOT_RE = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/
const MAX_SHOT_B64 = 2_000_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clean(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const v = value.replace(/\u0000/g, '').trim()
  return v === '' ? null : v.slice(0, max)
}

export const POST = withAdminSecurity(
  async (req, admin) => {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: '資料格式不正確' }, { status: 400 })
    }
    if (!isRecord(body)) return NextResponse.json({ error: '資料格式不正確' }, { status: 400 })

    const title = clean(body.title, 120)
    const description = clean(body.description, 4000)
    const severity = SEVERITIES.find((s) => s === body.severity)
    if (!title || !description || !severity) {
      return NextResponse.json({ error: '請填寫標題、發生了什麼事，並選擇嚴重程度' }, { status: 400 })
    }
    const pageUrl = clean(body.pageUrl, 500)
    const viewport = clean(body.viewport, 40)
    const userAgent = clean(body.userAgent, 300)

    let screenshot: AdminMailAttachment | null = null
    if (typeof body.screenshot === 'string' && body.screenshot !== '') {
      const m = SHOT_RE.exec(body.screenshot)
      if (!m || m[2].length > MAX_SHOT_B64) {
        return NextResponse.json({ error: '截圖格式不正確或太大（上限約 1.5MB）' }, { status: 400 })
      }
      screenshot = { filename: `screenshot.${m[1] === 'jpeg' ? 'jpg' : m[1]}`, content: Buffer.from(m[2], 'base64') }
    }

    const service = getLegacyServiceSupabase()
    const email = admin.email ?? 'unknown'

    // Belt-and-braces rate limit on top of the wrapper's: 5 reports per hour per admin.
    const since = new Date(Date.now() - 3600_000).toISOString()
    const { count, error: countError } = await service
      .from('admin_bug_reports')
      .select('id', { count: 'exact', head: true })
      .eq('reporter_email', email)
      .gte('created_at', since)
    if (countError) return NextResponse.json({ error: '暫時無法提交，請稍後再試' }, { status: 500 })
    if ((count ?? 0) >= MAX_PER_HOUR) {
      return NextResponse.json({ error: `每小時最多提交 ${MAX_PER_HOUR} 次，請稍後再試` }, { status: 429 })
    }

    // Latest site errors for context. Door-card errors are left out: they repeat hundreds of
    // times and would push every useful line out of the 10 shown.
    const errorRows: Row[] = []
    const { data: errData } = await service
      .from('site_error_log')
      .select('source, severity, message, created_at')
      .not('source', 'like', 'admin.door%')
      .order('created_at', { ascending: false })
      .limit(10)
    for (const r of (errData ?? []) as unknown as Row[]) errorRows.push(r)
    const recentErrors = errorRows.map((r) => ({
      at: str(r, ['created_at']),
      source: str(r, ['source']),
      severity: str(r, ['severity']),
      message: (str(r, ['message']) ?? '').slice(0, 200),
    }))

    const { data: inserted, error: insertError } = await service
      .from('admin_bug_reports')
      .insert({
        reporter_email: email,
        reporter_user_id: admin.id,
        severity,
        title,
        description,
        page_url: pageUrl,
        user_agent: userAgent,
        viewport,
        context: { recentErrors },
        has_screenshot: screenshot !== null,
      })
      .select('id')
      .single()
    if (insertError || !inserted) {
      console.error('[admin/bug-report] insert failed', insertError)
      return NextResponse.json({ error: '儲存失敗，請稍後再試' }, { status: 500 })
    }
    const id = String((inserted as Row).id)

    const errorsHtml =
      recentErrors.length === 0
        ? '<p style="color:#6b7a72">最近沒有網站錯誤記錄。</p>'
        : `<table style="border-collapse:collapse;font-size:13px;width:100%">${recentErrors
            .map(
              (e) =>
                `<tr><td style="padding:4px 8px 4px 0;color:#6b7a72;white-space:nowrap;vertical-align:top">${escapeHtml(e.at ?? '')}</td><td style="padding:4px 0"><b>${escapeHtml(e.source ?? '')}</b> ${escapeHtml(e.message)}</td></tr>`,
            )
            .join('')}</table>`
    const html = adminMailShell(
      `${SEVERITY_LABEL[severity]}：${title}`,
      `<p style="white-space:pre-wrap;line-height:1.7">${escapeHtml(description)}</p>
<table style="font-size:13px;margin:16px 0;border-collapse:collapse">
<tr><td style="padding:3px 12px 3px 0;color:#6b7a72">回報人</td><td>${escapeHtml(email)}</td></tr>
<tr><td style="padding:3px 12px 3px 0;color:#6b7a72">頁面</td><td>${escapeHtml(pageUrl ?? '—')}</td></tr>
<tr><td style="padding:3px 12px 3px 0;color:#6b7a72">螢幕</td><td>${escapeHtml(viewport ?? '—')}</td></tr>
<tr><td style="padding:3px 12px 3px 0;color:#6b7a72">瀏覽器</td><td>${escapeHtml(userAgent ?? '—')}</td></tr>
<tr><td style="padding:3px 12px 3px 0;color:#6b7a72">截圖</td><td>${screenshot ? '見附件' : '沒有'}</td></tr>
</table>
<h3 style="font-size:15px;margin:20px 0 6px">最近 10 條網站錯誤</h3>${errorsHtml}
<p><a href="https://space8.com.hk/admin/bug-reports">在後台查看與追蹤</a></p>`,
      severity === 'urgent' ? 'critical' : 'normal',
    )

    let emailSent = false
    try {
      await sendAdminMail({
        subject: `【${SEVERITY_LABEL[severity]}】${title}`,
        html,
        replyTo: email,
        attachments: screenshot ? [screenshot] : undefined,
      })
      emailSent = true
      await service.from('admin_bug_reports').update({ email_sent_at: new Date().toISOString() }).eq('id', id)
    } catch (err) {
      const message = err instanceof Error ? err.message : '電郵發送失敗'
      console.error('[admin/bug-report] email failed', err)
      await service.from('admin_bug_reports').update({ email_error: message.slice(0, 300) }).eq('id', id)
    }

    // The report is saved either way; the caller is told honestly whether the email went out.
    return NextResponse.json({ ok: true, id, emailSent })
  },
  { rateLimit: { bucket: 'admin_bug_report', max: 10, windowSeconds: 3600, identifierType: 'user' } },
)
