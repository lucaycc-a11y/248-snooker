import { SITE_CONTACT } from '@/lib/site/contact'

// Account deletion emails (code / deactivated / restored), in the same black
// card layout as booking-confirmation.ts. Bilingual 書面語 + English.

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function shell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="zh-HK">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background-color:#000000;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','PingFang HK','Noto Sans TC',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#000000;">
    <tr><td style="padding:48px 24px;">
      <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;" cellpadding="0" cellspacing="0">
        <tr><td style="text-align:center;padding-bottom:32px;">
          <img src="https://space8.com.hk/logos/space8-logo-email.png" alt="SPACE8" width="160" style="display:inline-block;max-width:160px;height:auto;" />
        </td></tr>
        <tr><td style="background-color:#0a0a0a;border-radius:24px;padding:40px 32px;">
          <h1 style="color:#ffffff;font-size:22px;font-weight:600;margin:0 0 24px;text-align:center;">${esc(title)}</h1>
          ${body}
          <div style="background-color:rgba(37,211,102,0.08);border:1px solid rgba(37,211,102,0.2);border-radius:12px;padding:16px;margin-top:24px;text-align:center;">
            <p style="color:#a3a3a3;font-size:12px;margin:0 0 8px;">需要協助？ Need help?</p>
            <a href="${SITE_CONTACT.whatsappUrl}" style="color:#25d366;font-size:14px;font-weight:600;text-decoration:none;">WhatsApp 聯絡我們 Contact Us</a>
          </div>
        </td></tr>
        <tr><td style="padding-top:24px;text-align:center;">
          <p style="color:#525252;font-size:12px;margin:0;">&copy; ${new Date().getFullYear()} SPACE8 · Hong Kong</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

const p = (s: string) => `<p style="color:#a3a3a3;font-size:14px;line-height:1.7;margin:0 0 12px;">${s}</p>`
const list = (items: string[]) =>
  `<ul style="color:#a3a3a3;font-size:14px;line-height:1.8;margin:0 0 12px;padding-left:20px;">${items.map((i) => `<li>${i}</li>`).join('')}</ul>`

export function formatPurgeDate(iso: string): { zh: string; en: string } {
  const d = new Date(iso)
  return {
    zh: d.toLocaleDateString('zh-HK', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: 'long', day: 'numeric' }),
    en: d.toLocaleDateString('en-GB', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: 'long', day: 'numeric' }),
  }
}

export function accountDeleteCodeEmail(code: string) {
  const subject = 'Space8 刪除帳戶驗證碼 Account deletion code'
  const html = shell('刪除帳戶驗證碼', `
    ${p('閣下正申請刪除 Space8 帳戶。請於 10 分鐘內輸入以下驗證碼：<br/>Enter this code within 10 minutes to delete your Space8 account:')}
    <div style="background:#141414;border:1px solid #262626;border-radius:16px;padding:20px;text-align:center;margin:8px 0 20px;">
      <span style="color:#ffffff;font-size:32px;font-weight:600;letter-spacing:10px;font-family:monospace;">${esc(code)}</span>
    </div>
    ${p('如非閣下本人操作，請忽略此電郵，帳戶不會有任何變更。<br/>If this was not you, ignore this email. Nothing will change.')}`)
  const text = `Space8 刪除帳戶驗證碼 / Account deletion code: ${code}\n此驗證碼於 10 分鐘後失效。This code expires in 10 minutes.\n如非閣下本人操作，請忽略此電郵。If this was not you, ignore this email.`
  return { subject, html, text }
}

export function accountDeactivatedEmail(purgeIso: string) {
  const d = formatPurgeDate(purgeIso)
  const subject = 'Space8 帳戶已停用 Account deactivated'
  const html = shell('帳戶已停用', `
    ${p(`閣下的 Space8 帳戶已即時停用。個人資料將於 <strong style="color:#ffffff;">${esc(d.zh)}</strong> 永久刪除。`)}
    ${list([
      `於 ${esc(d.zh)} 前重新登入，帳戶即自動恢復。`,
      '停用期間，積分及優惠券會被凍結；永久刪除後一併移除。',
      '未完成的預約已取消。',
      '歷史預約記錄按法例要求保留。',
    ])}
    ${p(`Your account has been deactivated. Your personal data will be permanently deleted on <strong style="color:#ffffff;">${esc(d.en)}</strong>. Sign in again before then to restore it automatically. Points and coupons are frozen until then and removed on permanent deletion. Unfinished bookings were cancelled; booking history is kept as required by law.`)}`)
  const text = `閣下的 Space8 帳戶已停用，個人資料將於 ${d.zh} 永久刪除。於此日期前重新登入即可恢復帳戶。\nYour account is deactivated and will be permanently deleted on ${d.en}. Sign in before then to restore it.`
  return { subject, html, text }
}

export function accountRestoredEmail() {
  const subject = 'Space8 帳戶已恢復 Account restored'
  const html = shell('帳戶已恢復', `
    ${p('歡迎回來。閣下的 Space8 帳戶已恢復，積分及優惠券可照常使用。停用時已取消的預約不會恢復。')}
    ${p('Welcome back. Your Space8 account has been restored and your points and coupons are available again. Bookings cancelled at deactivation stay cancelled.')}
    ${p('如非閣下本人登入，請立即聯絡我們。If you did not sign in, contact us right away.')}`)
  const text = '歡迎回來，閣下的 Space8 帳戶已恢復。Welcome back, your Space8 account has been restored.'
  return { subject, html, text }
}
