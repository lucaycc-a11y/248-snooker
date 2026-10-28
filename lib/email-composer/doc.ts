/**
 * Email composer document model — shared by the editor (browser) and the send route (server).
 *
 * A document is a theme plus an ordered list of blocks. `renderDoc` turns it into table-based,
 * inline-styled HTML that works in Gmail / Apple Mail / Outlook. `sanitizeDoc` is the only way
 * untrusted JSON (the editor, the Spark generator, saved templates) becomes a `EmailDoc`.
 */

export const LOGO_URL = 'https://space8.com.hk/logos/space8-logo-email.png'
export const MAX_BLOCKS = 40

export type Align = 'left' | 'center' | 'right'

export type EmailTheme = {
  pageBg: string
  cardBg: string
  cardBorder: string
  text: string
  muted: string
  accent: string
  buttonText: string
  /** Card width in px. */
  width: number
  radius: number
}

export type LogoBlock = { id: string; type: 'logo'; align: Align; width: number; src: string }
export type HeadingBlock = { id: string; type: 'heading'; text: string; align: Align; size: number }
export type TextBlock = { id: string; type: 'text'; text: string; align: Align; muted: boolean }
export type ImageBlock = { id: string; type: 'image'; src: string; alt: string; link: string; radius: number }
export type ButtonBlock = { id: string; type: 'button'; label: string; href: string; align: Align }
export type DividerBlock = { id: string; type: 'divider' }
export type SpacerBlock = { id: string; type: 'spacer'; height: number }
export type BigNumberBlock = { id: string; type: 'bignumber'; label: string; value: string; unit: string }

export type EmailBlock =
  | LogoBlock
  | HeadingBlock
  | TextBlock
  | ImageBlock
  | ButtonBlock
  | DividerBlock
  | SpacerBlock
  | BigNumberBlock

export type EmailBlockType = EmailBlock['type']

export type EmailDoc = {
  subject: string
  preheader: string
  theme: EmailTheme
  blocks: EmailBlock[]
  footer: string
}

export const BLOCK_LABEL: Record<EmailBlockType, string> = {
  logo: 'Logo',
  heading: '標題',
  text: '文字',
  image: '圖片',
  button: '按鈕',
  divider: '分隔線',
  spacer: '空白',
  bignumber: '大數字',
}

export const DEFAULT_THEME: EmailTheme = {
  pageBg: '#000000',
  cardBg: '#0a0a0a',
  cardBorder: '#1f1f1f',
  text: '#ffffff',
  muted: '#a3a3a3',
  accent: '#22c55e',
  buttonText: '#000000',
  width: 560,
  radius: 24,
}

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'SF Pro Display','PingFang HK','PingFang SC','Noto Sans TC','Noto Sans SC',sans-serif"

let counter = 0
export function newId(): string {
  counter += 1
  return `b${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 5)}`
}

export function newBlock(type: EmailBlockType): EmailBlock {
  const id = newId()
  switch (type) {
    case 'logo':
      return { id, type, align: 'center', width: 140, src: LOGO_URL }
    case 'heading':
      return { id, type, text: '標題', align: 'center', size: 26 }
    case 'text':
      return { id, type, text: '在這裡寫內容。可以用 {{name}} 代表會員稱呼。', align: 'left', muted: false }
    case 'image':
      return { id, type, src: '', alt: '', link: '', radius: 16 }
    case 'button':
      return { id, type, label: '了解更多', href: 'https://space8.com.hk', align: 'center' }
    case 'divider':
      return { id, type }
    case 'spacer':
      return { id, type, height: 24 }
    case 'bignumber':
      return { id, type, label: 'WELCOME GIFT', value: '100', unit: 'pts' }
  }
}

export function defaultDoc(): EmailDoc {
  return {
    subject: 'Space8 最新消息',
    preheader: '',
    theme: { ...DEFAULT_THEME },
    footer: '你收到這封電郵，因為你是 Space8 會員。',
    blocks: [
      newBlock('logo'),
      { ...(newBlock('heading') as HeadingBlock), text: 'Hi {{name}}' },
      newBlock('text'),
      newBlock('button'),
    ],
  }
}

// ── escaping / validation ─────────────────────────────────────────────────────────────────────
export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Multi-line plain text → escaped HTML with <br>. {{name}} is kept as a placeholder for `personalise`. */
function textToHtml(value: string): string {
  return esc(value).replace(/\r?\n/g, '<br />')
}

const COLOR_RE = /^#[0-9a-fA-F]{6}$/

function asString(v: unknown, max: number, fallback = ''): string {
  return typeof v === 'string' ? v.slice(0, max) : fallback
}
function asColor(v: unknown, fallback: string): string {
  return typeof v === 'string' && COLOR_RE.test(v) ? v : fallback
}
function asNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}
function asAlign(v: unknown, fallback: Align): Align {
  return v === 'left' || v === 'center' || v === 'right' ? v : fallback
}
/** Only https URLs (and mailto) may end up in href/src. Anything else becomes ''. */
export function safeUrl(v: unknown, allowMailto = false): string {
  if (typeof v !== 'string') return ''
  const s = v.trim().slice(0, 1000)
  if (/^https:\/\/[^\s"'<>]+$/i.test(s)) return s
  if (allowMailto && /^mailto:[^\s"'<>]+$/i.test(s)) return s
  return ''
}

function isRec(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function sanitizeBlock(raw: unknown): EmailBlock | null {
  if (!isRec(raw)) return null
  const id = asString(raw.id, 40) || newId()
  switch (raw.type) {
    case 'logo':
      return { id, type: 'logo', align: asAlign(raw.align, 'center'), width: asNum(raw.width, 40, 400, 140), src: safeUrl(raw.src) || LOGO_URL }
    case 'heading':
      return { id, type: 'heading', text: asString(raw.text, 200), align: asAlign(raw.align, 'center'), size: asNum(raw.size, 14, 56, 26) }
    case 'text':
      return { id, type: 'text', text: asString(raw.text, 4000), align: asAlign(raw.align, 'left'), muted: raw.muted === true }
    case 'image':
      return { id, type: 'image', src: safeUrl(raw.src), alt: asString(raw.alt, 200), link: safeUrl(raw.link, true), radius: asNum(raw.radius, 0, 40, 16) }
    case 'button':
      return { id, type: 'button', label: asString(raw.label, 80), href: safeUrl(raw.href, true), align: asAlign(raw.align, 'center') }
    case 'divider':
      return { id, type: 'divider' }
    case 'spacer':
      return { id, type: 'spacer', height: asNum(raw.height, 4, 120, 24) }
    case 'bignumber':
      return { id, type: 'bignumber', label: asString(raw.label, 60), value: asString(raw.value, 20), unit: asString(raw.unit, 12) }
    default:
      return null
  }
}

export function sanitizeDoc(raw: unknown): EmailDoc | null {
  if (!isRec(raw)) return null
  const t = isRec(raw.theme) ? raw.theme : {}
  const theme: EmailTheme = {
    pageBg: asColor(t.pageBg, DEFAULT_THEME.pageBg),
    cardBg: asColor(t.cardBg, DEFAULT_THEME.cardBg),
    cardBorder: asColor(t.cardBorder, DEFAULT_THEME.cardBorder),
    text: asColor(t.text, DEFAULT_THEME.text),
    muted: asColor(t.muted, DEFAULT_THEME.muted),
    accent: asColor(t.accent, DEFAULT_THEME.accent),
    buttonText: asColor(t.buttonText, DEFAULT_THEME.buttonText),
    width: asNum(t.width, 320, 700, DEFAULT_THEME.width),
    radius: asNum(t.radius, 0, 40, DEFAULT_THEME.radius),
  }
  const blocksRaw = Array.isArray(raw.blocks) ? raw.blocks.slice(0, MAX_BLOCKS) : []
  const blocks: EmailBlock[] = []
  const seen = new Set<string>()
  for (const b of blocksRaw) {
    const block = sanitizeBlock(b)
    if (!block) continue
    if (seen.has(block.id)) block.id = newId()
    seen.add(block.id)
    blocks.push(block)
  }
  return {
    subject: asString(raw.subject, 150),
    preheader: asString(raw.preheader, 200),
    footer: asString(raw.footer, 400),
    theme,
    blocks,
  }
}

// ── rendering ─────────────────────────────────────────────────────────────────────────────────
function cell(inner: string, align: Align = 'left', pad = '0 0 16px'): string {
  return `<tr><td align="${align}" style="padding:${pad};text-align:${align};">${inner}</td></tr>`
}

function renderBlock(b: EmailBlock, th: EmailTheme): string {
  switch (b.type) {
    case 'logo':
      return cell(`<img src="${esc(b.src || LOGO_URL)}" alt="SPACE8" width="${b.width}" style="display:inline-block;width:${b.width}px;max-width:100%;height:auto;border:0;" />`, b.align, '0 0 24px')
    case 'heading':
      return cell(`<h1 style="margin:0;color:${th.text};font-size:${b.size}px;line-height:1.25;font-weight:700;text-align:${b.align};">${textToHtml(b.text)}</h1>`, b.align, '0 0 16px')
    case 'text':
      return cell(`<p style="margin:0;color:${b.muted ? th.muted : th.text};font-size:15px;line-height:1.65;text-align:${b.align};">${textToHtml(b.text)}</p>`, b.align)
    case 'image': {
      if (!b.src) return ''
      const img = `<img src="${esc(b.src)}" alt="${esc(b.alt)}" width="100%" style="display:block;width:100%;max-width:100%;height:auto;border:0;border-radius:${b.radius}px;" />`
      return cell(b.link ? `<a href="${esc(b.link)}" style="text-decoration:none;">${img}</a>` : img, 'center', '0 0 16px')
    }
    case 'button': {
      if (!b.href) return ''
      const btn = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;"><tr><td style="border-radius:12px;background-color:${th.accent};"><a href="${esc(b.href)}" style="display:inline-block;min-width:160px;background-color:${th.accent};color:${th.buttonText};font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:12px;text-align:center;">${esc(b.label || '查看')}</a></td></tr></table>`
      return cell(btn, b.align, '8px 0 20px')
    }
    case 'divider':
      return cell(`<div style="border-top:1px solid ${th.cardBorder};height:1px;line-height:1px;font-size:1px;">&nbsp;</div>`, 'center', '8px 0 20px')
    case 'spacer':
      return `<tr><td style="height:${b.height}px;line-height:${b.height}px;font-size:1px;">&nbsp;</td></tr>`
    case 'bignumber':
      return cell(
        `<div style="color:${th.accent};font-size:12px;font-weight:700;letter-spacing:0.3em;margin:0 0 8px;">${esc(b.label)}</div>` +
          `<div style="color:${th.accent};font-size:64px;line-height:1;font-weight:800;">${esc(b.value)}<span style="font-size:24px;margin-left:6px;">${esc(b.unit)}</span></div>`,
        'center',
        '8px 0 20px',
      )
  }
}

/** Full HTML document. Placeholders like {{name}} are left in; call `personalise` per recipient. */
export function renderDoc(doc: EmailDoc): string {
  const th = doc.theme
  const body = doc.blocks.map((b) => renderBlock(b, th)).join('\n')
  const year = new Date().getFullYear()
  return `<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light dark" />
<title>${esc(doc.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${th.pageBg};font-family:${FONT_STACK};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(doc.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${th.pageBg}" style="background-color:${th.pageBg};">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:${th.width}px;margin:0 auto;">
<tr><td bgcolor="${th.cardBg}" style="background-color:${th.cardBg};border:1px solid ${th.cardBorder};border-radius:${th.radius}px;padding:36px 32px 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${body}
</table>
</td></tr>
<tr><td align="center" style="padding-top:20px;text-align:center;">
${doc.footer ? `<p style="color:${th.muted};font-size:12px;line-height:1.6;margin:0 0 10px;">${textToHtml(doc.footer)}</p>` : ''}
<p style="color:${th.muted};font-size:12px;margin:0;opacity:.7;">&copy; ${year} SPACE8 · Hong Kong</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

/** Replace {{name}} with the recipient's (escaped) display name. */
export function personalise(html: string, vars: { name: string }): string {
  return html.replace(/\{\{\s*name\s*\}\}/g, esc(vars.name))
}

/**
 * Admin-authored raw HTML is trusted enough to send, but scripts/iframes/forms/inline handlers
 * never belong in an email, so they are removed.
 */
export function stripDangerousHtml(html: string): string {
  return html
    .replace(/<\s*(script|iframe|object|embed|form|link|meta\s+http-equiv)[\s\S]*?(<\/\s*\1\s*>|\/?>)/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=$2#$2')
}
