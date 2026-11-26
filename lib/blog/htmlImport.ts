import { plainText, visualWidth } from '@/lib/blog/seoCheck'

// Turns an uploaded .html / .md file into a blog post draft and applies deterministic SEO fixes.
// Pure string work (no DOM, no I/O) so it runs in the editor and can be unit-tested.
//
// Every optional fix has an id. The editor can re-run the import with `disabled` ids to undo a
// single fix. Removing dangerous markup (`strip`) is always applied.

export type ImportFixId = 'title' | 'description' | 'h1' | 'headings' | 'alt' | 'links' | 'cta' | 'faq'
export type ImportReportItem = { id: ImportFixId | 'strip'; level: 'fixed' | 'info' | 'warn'; text: string; revertable: boolean }

export type ImportResult = {
  title: string
  slug: string
  excerpt: string
  seoTitle: string
  seoDescription: string
  content: string
  report: ImportReportItem[]
}

export type ImportOptions = { disabled?: readonly ImportFixId[]; fallbackTitle?: string }

const BASE_HOST = /^https?:\/\/(www\.)?space8\.com\.hk/i

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function clean(s: string): string {
  return decode(plainText(s)).replace(/\s+/g, ' ').trim()
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function truncateByWidth(text: string, maxWidth: number): string {
  let out = ''
  let w = 0
  for (const ch of text) {
    const cw = visualWidth(ch)
    if (w + cw > maxWidth) return out.trimEnd() + '…'
    out += ch
    w += cw
  }
  return out
}

function metaContent(html: string, key: string): string {
  const re = new RegExp(`<meta\\b[^>]*(?:name|property)\\s*=\\s*["']${key}["'][^>]*>`, 'i')
  const tag = html.match(re)?.[0]
  if (!tag) return ''
  const m = tag.match(/content\s*=\s*"([^"]*)"/i) ?? tag.match(/content\s*=\s*'([^']*)'/i)
  return m ? decode(m[1]).trim() : ''
}

function humanizeFilename(src: string): string {
  const file = src.split('?')[0].split('/').pop() ?? ''
  return decode(file.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ')).trim()
}

/** Remove everything that must never be stored: scripts, styles, frames, forms, handlers. */
function strip(body: string): { html: string; removed: number } {
  let removed = 0
  const drop = (re: RegExp) => {
    body = body.replace(re, () => {
      removed += 1
      return ''
    })
  }
  drop(/<!--[\s\S]*?-->/g)
  drop(/<(script|style|iframe|noscript|template|object|embed|svg|form|select|textarea|button|head|title)\b[\s\S]*?<\/\1>/gi)
  drop(/<(link|meta|base|input)\b[^>]*>/gi)
  body = body.replace(/\s(on[a-z]+|style|contenteditable)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, () => {
    removed += 1
    return ''
  })
  body = body.replace(/(href|src)\s*=\s*("|')\s*(javascript|data|vbscript):[^"']*\2/gi, () => {
    removed += 1
    return ''
  })
  return { html: body, removed }
}

function extractBody(raw: string): string {
  const m = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  return (m ? m[1] : raw).trim()
}

export function importHtml(raw: string, opts: ImportOptions = {}): ImportResult {
  const off = new Set<string>(opts.disabled ?? [])
  const report: ImportReportItem[] = []
  const add = (id: ImportReportItem['id'], level: ImportReportItem['level'], text: string, revertable = true) =>
    report.push({ id, level, text, revertable })

  const docTitle = clean(raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
  const metaDesc = metaContent(raw, 'description') || metaContent(raw, 'og:description')
  const metaTitle = metaContent(raw, 'og:title')

  const stripped = strip(extractBody(raw))
  let body = stripped.html
  if (stripped.removed > 0) add('strip', 'info', `已移除 ${stripped.removed} 項不安全或多餘的內容（script、樣式、事件屬性等）`, false)

  // Layout wrappers and legacy tags → the tags the renderer keeps.
  body = body
    .replace(/<\/?(html|body|main|article|header|footer|nav|center|font)\b[^>]*>/gi, '')
    .replace(/<(b)(\s[^>]*)?>/gi, '<strong>')
    .replace(/<\/b>/gi, '</strong>')
    .replace(/<(i)(\s[^>]*)?>/gi, '<em>')
    .replace(/<\/i>/gi, '</em>')

  // ── H1 / title ─────────────────────────────────────────────
  const h1s = [...body.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
  const firstH1 = h1s.length > 0 ? clean(h1s[0][1]) : ''
  let title = (firstH1 || metaTitle || docTitle || opts.fallbackTitle || '').replace(/\s*[|｜–—-]\s*Space\s?8.*$/i, '').trim()
  if (h1s.length > 0 && !off.has('h1')) {
    let first = true
    body = body.replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, (_m, inner: string) => {
      if (first && clean(inner) === firstH1) {
        first = false
        return '' // the page already renders the title as the only H1
      }
      return `<h2>${inner}</h2>`
    })
    add('h1', 'fixed', h1s.length === 1 ? '已移除內文 H1（頁面標題本身就是 H1，避免重複）' : `已處理 ${h1s.length} 個 H1：只保留標題，其餘降為 H2`)
  } else if (h1s.length > 0) {
    add('h1', 'warn', `內文有 ${h1s.length} 個 H1，建議只保留一個`)
  }
  if (!title) add('title', 'warn', '找不到標題，請手動填寫', false)
  else if (!firstH1 && !off.has('title')) add('title', 'fixed', `標題取自 ${metaTitle ? 'og:title' : docTitle ? '<title>' : '檔名'}：「${title}」`)

  // ── Heading structure ─────────────────────────────────────
  if (!off.has('headings')) {
    const deep = (body.match(/<h[4-6]\b/gi) ?? []).length
    if (deep > 0) {
      body = body.replace(/<(\/?)h[4-6]\b/gi, '<$1h3')
      add('headings', 'fixed', `${deep} 個 H4–H6 小標題已改為 H3，標題層級更清晰`)
    }
  }

  // ── Images: alt text ───────────────────────────────────────
  if (!off.has('alt')) {
    let filled = 0
    body = body.replace(/<img\b[^>]*>/gi, (tag) => {
      const alt = tag.match(/\balt\s*=\s*("([^"]*)"|'([^']*)')/i)
      if (alt && (alt[2] ?? alt[3] ?? '').trim() !== '') return tag
      const src = tag.match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)')/i)
      const text = humanizeFilename(src ? (src[2] ?? src[3] ?? '') : '') || title || 'Space8'
      filled += 1
      const without = tag.replace(/\salt\s*=\s*("[^"]*"|'[^']*')/i, '')
      return without.replace(/<img/i, `<img alt="${escAttr(text)}"`)
    })
    if (filled > 0) add('alt', 'fixed', `${filled} 張圖片缺少 alt，已用檔名或標題補上（建議再改成描述圖片內容的文字）`)
  }

  // ── Links ──────────────────────────────────────────────────
  if (!off.has('links')) {
    let n = 0
    body = body.replace(/href\s*=\s*"([^"]*)"/gi, (m, url: string) => {
      if (!BASE_HOST.test(url)) return m
      n += 1
      return `href="${url.replace(BASE_HOST, '') || '/'}"`
    })
    if (n > 0) add('links', 'fixed', `${n} 個連去本站的完整網址已改為站內路徑（對搜尋引擎更清楚）`)
  }

  // ── FAQ: Q&A headings → details/summary so FAQ structured data can be built ──
  if (!off.has('faq') && !/<details\b/i.test(body)) {
    let n = 0
    body = body.replace(/<h3\b[^>]*>([\s\S]*?[?？])\s*<\/h3>\s*<p>([\s\S]*?)<\/p>/gi, (_m, q: string, a: string) => {
      n += 1
      return `<details><summary>${q}</summary><p>${a}</p></details>`
    })
    if (n > 0) add('faq', 'fixed', `${n} 組「問題 + 答案」已轉成 FAQ 格式，發佈後會自動產生 FAQ 結構化資料`)
  }

  // ── CTA ────────────────────────────────────────────────────
  if (!off.has('cta') && !/data-s8\s*=/.test(body)) {
    body = `${body.trim()}\n<div data-s8="cta-booking"></div>`
    add('cta', 'fixed', '文末已加入預約 CTA（原稿沒有行動呼籲）')
  }

  body = body.replace(/\n{3,}/g, '\n\n').trim()

  // ── Description ────────────────────────────────────────────
  const firstPara = clean(body.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '')
  const rawDesc = metaDesc || firstPara
  const excerpt = truncateByWidth(rawDesc, 300)
  let seoDescription = metaDesc ? truncateByWidth(metaDesc, 160) : ''
  if (!seoDescription && !off.has('description') && firstPara) {
    seoDescription = truncateByWidth(firstPara, 150)
    add('description', 'fixed', 'SEO 描述原稿沒有，已取自第一段（建議再潤飾，加入關鍵字和行動呼籲）')
  } else if (metaDesc && visualWidth(metaDesc) > 160) {
    add('description', 'fixed', 'SEO 描述太長，已截短至搜尋結果可顯示的長度')
  }
  const seoTitle = title ? truncateByWidth(title, 60) : ''

  const slug = slugify(title)
  if (!slug) add('title', 'warn', '標題是中文，請填一個英文網址代稱（例如 pool-table-guide），可按 Spark 自動建議', false)

  return { title, slug, excerpt, seoTitle, seoDescription, content: body, report }
}

// ── Markdown (.md) ───────────────────────────────────────────

function inline(md: string): string {
  return md
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_m, alt: string, src: string) => `<img alt="${escAttr(alt)}" src="${escAttr(src)}">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_m, text: string, href: string) => `<a href="${escAttr(href)}">${text}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

export function markdownToHtml(md: string): { html: string; meta: Record<string, string> } {
  const meta: Record<string, string> = {}
  let text = md.replace(/\r\n?/g, '\n')
  const fm = text.match(/^---\n([\s\S]*?)\n---\n?/)
  if (fm) {
    for (const line of fm[1].split('\n')) {
      const m = line.match(/^([A-Za-z_]+)\s*:\s*(.*)$/)
      if (m) meta[m[1].toLowerCase()] = m[2].replace(/^["']|["']$/g, '').trim()
    }
    text = text.slice(fm[0].length)
  }

  const out: string[] = []
  let para: string[] = []
  // Cast: `list` is reassigned inside the flush closures, which control-flow analysis cannot see.
  let list = null as { tag: 'ul' | 'ol'; items: string[] } | null
  const flushPara = () => {
    if (para.length > 0) out.push(`<p>${inline(para.join(' '))}</p>`)
    para = []
  }
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`)
    list = null
  }

  for (const line of text.split('\n')) {
    const t = line.trim()
    const heading = t.match(/^(#{1,6})\s+(.*)$/)
    const ul = t.match(/^[-*+]\s+(.*)$/)
    const ol = t.match(/^\d+[.)]\s+(.*)$/)
    if (t === '') {
      flushPara()
      flushList()
    } else if (heading) {
      flushPara()
      flushList()
      out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`)
    } else if (ul || ol) {
      flushPara()
      const tag = ul ? 'ul' : 'ol'
      if (list && list.tag !== tag) flushList()
      if (!list) list = { tag, items: [] }
      list.items.push((ul ?? ol)![1])
    } else if (/^>\s?/.test(t)) {
      flushPara()
      flushList()
      out.push(`<blockquote><p>${inline(t.replace(/^>\s?/, ''))}</p></blockquote>`)
    } else if (/^(-{3,}|\*{3,})$/.test(t)) {
      flushPara()
      flushList()
      out.push('<hr>')
    } else {
      flushList()
      para.push(t)
    }
  }
  flushPara()
  flushList()
  return { html: out.join('\n'), meta }
}

/** Import any dropped text file by extension. */
export function importTextFile(name: string, text: string, opts: ImportOptions = {}): ImportResult {
  const fallbackTitle = opts.fallbackTitle ?? humanizeFilename(name)
  if (/\.(md|markdown|txt)$/i.test(name)) {
    const { html, meta } = markdownToHtml(text)
    const res = importHtml(html, { ...opts, fallbackTitle: meta.title || fallbackTitle })
    if (meta.description && !res.seoDescription) res.seoDescription = truncateByWidth(meta.description, 160)
    if (meta.description && !res.excerpt) res.excerpt = truncateByWidth(meta.description, 300)
    if (meta.slug) res.slug = slugify(meta.slug)
    return res
  }
  return importHtml(text, { ...opts, fallbackTitle })
}
