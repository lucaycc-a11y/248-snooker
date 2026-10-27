import { NextResponse } from 'next/server'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { writeAdminAudit } from '@/lib/admin/audit'
import { adminMailShell, escapeHtml, ownerEmail, sendAdminMail } from '@/lib/admin/alertMail'

// 發送測試電郵 — goes to the owner only (never to the other admins). Shows what an ordinary
// alert and a critical alert look like, so the owner can confirm Resend delivery end to end.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_PER_HOUR = 3

export const POST = withAdminSecurity(
  async (_req, admin) => {
    const email = admin.email ?? 'unknown'
    const service = getLegacyServiceSupabase()
    const since = new Date(Date.now() - 3600_000).toISOString()
    const { count } = await service
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('action', 'test_email_sent')
      .eq('admin_email', email)
      .gte('created_at', since)
    if ((count ?? 0) >= MAX_PER_HOUR) {
      return NextResponse.json({ error: `每小時最多發送 ${MAX_PER_HOUR} 封測試電郵` }, { status: 429 })
    }

    try {
      const out = await sendAdminMail({
        audience: 'owner',
        subject: '【測試】Space8 後台電郵通知運作正常',
        html: adminMailShell(
          '測試電郵',
          `<p>收到這封信，代表後台電郵通知（Resend）運作正常。此信只發給 ${escapeHtml(ownerEmail())}，不會發給其他管理員。</p>
<p><b>電郵分兩種：</b></p>
<ul style="line-height:1.8"><li>一般警報（客人付款失敗、網站錯誤增加、問題回報）：只發給你。</li>
<li>極嚴重付款問題（KPay 已付款但預約未確認、重複扣款）：發給所有有效管理員。以下是範例：</li></ul>
<div style="border-left:4px solid #c0392b;background:#fdf3f2;padding:12px 14px;border-radius:6px"><b>範例：付款異常，需要立即處理</b><br><span style="color:#51605a">S8-0000：KPay 顯示已付款，但預約未確認（範例，不是真實資料）</span></div>`,
        ),
      })
      await writeAdminAudit({
        adminUserId: admin.id,
        adminEmail: email,
        action: 'test_email_sent',
        targetTable: 'email',
        targetId: null,
        beforeValue: null,
        afterValue: { recipients: out.recipients },
      })
      return NextResponse.json({ ok: true, to: out.recipients })
    } catch (err) {
      console.error('[admin/test-email] failed', err)
      return NextResponse.json({ error: err instanceof Error ? err.message : '發送失敗' }, { status: 502 })
    }
  },
  { rateLimit: { bucket: 'admin_test_email', max: 5, windowSeconds: 3600, identifierType: 'user' } },
)
