// Deterministic SEO checks for a blog post. Pure (no I/O) so the editor can run it live and
// the Spark route can hand the same findings to the model.

export type SeoLevel = 'bad' | 'warn' | 'ok'
export type SeoIssue = { level: SeoLevel; text: string }
export type SeoInput = {
  title: string
  slug: string
  excerpt: string
  seoTitle: string
  seoDescription: string
  content: string
  cover: string
  keyword: string
}

// Search snippets truncate by pixel width: CJK glyphs are ~2x a Latin glyph.
export function visualWidth(s: string): number {
  let w = 0
  for (const ch of s) w += /[　-鿿＀-￯]/.test(ch) ? 2 : 1
  return w
}

export function plainText(html: string): string {
  return html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

export function contentSize(html: string): number {
  const t = plainText(html)
  const cjk = (t.match(/[　-鿿]/g) ?? []).length
  const latin = (t.replace(/[　-鿿]/g, ' ').match(/[A-Za-z0-9]+/g) ?? []).length
  return cjk + latin
}

export function analyseSeo(i: SeoInput): { score: number; issues: SeoIssue[] } {
  const issues: SeoIssue[] = []
  let score = 100
  const add = (level: SeoLevel, text: string, cost: number) => {
    issues.push({ level, text })
    if (level !== 'ok') score -= cost
  }
  const kw = i.keyword.trim().toLowerCase()
  const title = (i.seoTitle || i.title).trim()
  const desc = (i.seoDescription || i.excerpt).trim()
  const body = i.content
  const text = plainText(body)

  const tw = visualWidth(title)
  if (!title) add('bad', '未有標題', 15)
  else if (tw > 60) add('warn', `SEO 標題太長（${tw}/60），搜尋結果會被截斷`, 8)
  else if (tw < 20) add('warn', `SEO 標題太短（${tw}），建議 20–60`, 6)
  else add('ok', `SEO 標題長度適中（${tw}/60）`, 0)

  const dw = visualWidth(desc)
  if (!desc) add('bad', '未有 SEO 描述', 12)
  else if (dw > 160) add('warn', `SEO 描述太長（${dw}/160）`, 6)
  else if (dw < 80) add('warn', `SEO 描述太短（${dw}），建議 80–160`, 6)
  else add('ok', `SEO 描述長度適中（${dw}/160）`, 0)

  if (kw) {
    if (!title.toLowerCase().includes(kw)) add('warn', '標題未包含目標關鍵字', 8)
    else add('ok', '標題包含目標關鍵字', 0)
    if (!desc.toLowerCase().includes(kw)) add('warn', '描述未包含目標關鍵字', 5)
    if (!text.slice(0, 200).toLowerCase().includes(kw)) add('warn', '開首 200 字未出現目標關鍵字', 5)
  } else {
    add('warn', '未填目標關鍵字，Spark 無法針對優化', 3)
  }

  if (/<h1\b/i.test(body)) add('warn', '內文有 H1；頁面標題已係 H1，內文請用 H2/H3', 6)
  const h2 = (body.match(/<h2\b/gi) ?? []).length
  if (h2 < 2) add('warn', `H2 小標題只有 ${h2} 個，建議至少 2 個以分段`, 6)
  else add('ok', `有 ${h2} 個 H2 小標題`, 0)

  const imgs = body.match(/<img\b[^>]*>/gi) ?? []
  const noAlt = imgs.filter((t) => !/\balt\s*=\s*"[^"]+"/i.test(t)).length
  if (noAlt > 0) add('warn', `${noAlt} 張圖片缺少 alt 文字`, 6)
  else if (imgs.length > 0) add('ok', '所有圖片都有 alt', 0)

  const internal = (body.match(/<a\b[^>]*href\s*=\s*"(\/(?!\/)|https?:\/\/(www\.)?space8\.com\.hk)[^"]*"/gi) ?? []).length
  if (internal < 1) add('warn', '沒有內部連結（例如連去 /book）', 6)
  else add('ok', `有 ${internal} 個內部連結`, 0)

  if (!/data-s8\s*=/.test(body)) add('warn', '文章內沒有 CTA（預約／會員）', 8)
  else add('ok', '文章內有 CTA', 0)

  const size = contentSize(body)
  if (size < 500) add('warn', `內容偏短（約 ${size} 字詞），建議 600 以上`, 8)
  else add('ok', `內容長度充足（約 ${size} 字詞）`, 0)

  if (!i.cover) add('warn', '未設定封面圖（分享預覽會空白）', 5)
  if (!i.excerpt.trim()) add('warn', '未有摘要', 3)
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(i.slug)) add('warn', '網址代稱建議只用小寫英文、數字同連字號', 4)

  return { score: Math.max(0, Math.min(100, score)), issues }
}
