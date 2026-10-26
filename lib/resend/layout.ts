/**
 * Shared Space8 email shell — the black logo / card / footer frame used by the
 * booking confirmation, extracted so transactional emails share one layout.
 *
 * Callers pass already-escaped HTML for `bodyHtml`; `escapeHtml` is exported
 * for any user- or env-derived value that ends up inside it.
 */

export type EmailLayoutLocale = 'zh-HK' | 'zh-CN' | 'en'

const GREEN = '#22c55e'
const FONT_STACK = "-apple-system,BlinkMacSystemFont,'SF Pro Display','PingFang HK','PingFang SC','Noto Sans TC','Noto Sans SC',sans-serif"

const HTML_LANG: Record<EmailLayoutLocale, string> = {
  'zh-HK': 'zh-HK',
  'zh-CN': 'zh-CN',
  en: 'en',
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Pill CTA matching the booking email's primary button. `href` must be pre-escaped. */
export function emailButton(href: string, label: string): string {
  return `<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                <tr>
                  <td style="border-radius:12px;background-color:${GREEN};">
                    <a href="${href}" style="display:inline-block;min-width:200px;background-color:${GREEN};color:#000000;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:12px;text-align:center;">${label}</a>
                  </td>
                </tr>
              </table>`
}

export function emailParagraph(html: string, opts: { muted?: boolean; small?: boolean; center?: boolean } = {}): string {
  const color = opts.muted ? '#a3a3a3' : '#ffffff'
  const size = opts.small ? 13 : 15
  const align = opts.center ? 'center' : 'left'
  return `<p style="color:${color};font-size:${size}px;line-height:1.6;margin:0 0 16px;text-align:${align};">${html}</p>`
}

export function emailDivider(): string {
  return `<div style="border-top:1px solid #262626;margin:24px 0;"></div>`
}

export function renderEmailLayout(params: {
  locale: EmailLayoutLocale
  title: string
  /** Hidden inbox preview line. */
  preheader: string
  bodyHtml: string
  footerHtml?: string
}): string {
  const year = new Date().getFullYear()
  return `<!DOCTYPE html>
<html lang="${HTML_LANG[params.locale]}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${params.title}</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;font-family:${FONT_STACK};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${params.preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#000000" style="background-color:#000000;">
    <tr>
      <td style="padding:48px 24px;">
        <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="text-align:center;padding-bottom:32px;">
              <img src="https://space8.com.hk/logos/space8-logo-email.png" alt="SPACE8" width="160" height="auto" style="display:inline-block;max-width:160px;height:auto;" />
            </td>
          </tr>
          <tr>
            <td bgcolor="#0a0a0a" style="background-color:#0a0a0a;border:1px solid #1f1f1f;border-radius:24px;padding:40px 32px;">
              <h1 style="color:#ffffff;font-size:22px;font-weight:600;margin:0 0 24px;text-align:center;">${params.title}</h1>
              ${params.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding-top:24px;text-align:center;">
              ${params.footerHtml ? `<p style="color:#525252;font-size:11px;line-height:1.6;margin:0;">${params.footerHtml}</p>` : ''}
              <p style="color:#525252;font-size:12px;margin:16px 0 0;">&copy; ${year} SPACE8 · Hong Kong</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
