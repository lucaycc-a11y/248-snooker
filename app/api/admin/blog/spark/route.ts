import { NextResponse } from 'next/server'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'
import { friendlyAiError, mimoChat } from '@/lib/ai/mimo'
import { analyseSeo } from '@/lib/blog/seoCheck'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const BASE = `你是 Spark，由 FORM 開發的 AI 助手，替 Space8（香港預約制桌球室）寫作同優化 blog。不要提任何其他公司或模型名稱。
Blog 嘅目的係 SEO：幫人喺 Google 搜尋到 Space8。語氣：簡單、自信、有禮，不浮誇、不用感嘆號；預設繁體中文（廣東話書面語）。
硬性規則：
- 絕不編造價錢、營業時間、地址、優惠、統計數字或客戶評價；沒有提供就唔寫，或叫讀者睇預約頁。
- content 只可用這些 HTML：p h2 h3 ul ol li blockquote strong em a img table thead tbody tr th td details summary figure figcaption br hr，以及 CTA：<div data-s8="cta-booking"></div>、<div data-s8="cta-member"></div>。
- 內文不要用 h1（頁面標題已是 H1）。連結只可用 https 或站內路徑 /book、/member。圖片一定要有 alt。
- 只輸出一個 JSON 物件，不要 markdown、不要解釋。`

const SHAPE = `JSON 格式：{"title":"文章標題","slug":"小寫英文-連字號","excerpt":"摘要","seo_title":"≤30 個中文字","seo_description":"≤75 個中文字，包含關鍵字同行動呼籲","content":"HTML","notes":["你做了甚麼改動，最多 6 條，每條一句"]}`

function parseJson(text: string): Record<string, unknown> | null {
  const t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const a = t.indexOf('{')
  const b = t.lastIndexOf('}')
  if (a < 0 || b <= a) return null
  try {
    const v: unknown = JSON.parse(t.slice(a, b + 1))
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const str = (v: unknown, max: number): string | undefined => (typeof v === 'string' ? v.slice(0, max) : undefined)

export const POST = withAdminSecurity(
  async (req) => {
    const body: unknown = await req.json().catch(() => null)
    const b = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
    const mode = b.mode === 'generate' ? 'generate' : 'optimize'
    const keyword = (str(b.keyword, 80) ?? '').trim()
    const instruction = (str(b.instruction, 1500) ?? '').trim()
    const post = {
      title: str(b.title, 200) ?? '', slug: str(b.slug, 120) ?? '', excerpt: str(b.excerpt, 600) ?? '',
      seoTitle: str(b.seo_title, 200) ?? '', seoDescription: str(b.seo_description, 400) ?? '',
      content: str(b.content, 120_000) ?? '', cover: str(b.cover, 500) ?? '', keyword,
    }
    let user: string
    if (mode === 'generate') {
      if (instruction.length < 4 && !keyword) return NextResponse.json({ error: '請填目標關鍵字或文章主題' }, { status: 400 })
      user = `請寫一篇 SEO 文章（約 800–1200 字，5–7 個 H2 小標題，中段同文末各放一個 CTA，最後一節為 FAQ 用 details/summary）。\n目標關鍵字：${keyword || '（未指定）'}\n主題／要求：${instruction || '（按關鍵字自行決定）'}\n${SHAPE}`
    } else {
      if (post.content.trim().length < 20) return NextResponse.json({ error: '內容太少，先寫或貼上文章' }, { status: 400 })
      const found = analyseSeo(post).issues.filter((x) => x.level !== 'ok').map((x) => `- ${x.text}`).join('\n') || '（無）'
      user = `請優化以下文章嘅 SEO，保留原意同事實，只改善結構、標題、描述、alt、內部連結同 CTA 位置（約第 2 節後同文末，已有就唔好重複）。\n目標關鍵字：${keyword || '（未指定，請自行判斷最合適嘅一個）'}\n額外要求：${instruction || '（無）'}\n系統偵測到嘅問題：\n${found}\n\n現有資料：\n${JSON.stringify({ title: post.title, slug: post.slug, excerpt: post.excerpt, seo_title: post.seoTitle, seo_description: post.seoDescription, content: post.content })}\n${SHAPE}`
    }
    try {
      const out = await mimoChat({ system: `${BASE}\n${SHAPE}`, user, task: 'explain', maxTokens: 6000, timeoutMs: 55_000 })
      const p = parseJson(out.text)
      if (!p) return NextResponse.json({ error: 'Spark 未能產生有效內容，請再試' }, { status: 502 })
      const notes = Array.isArray(p.notes) ? p.notes.filter((n): n is string => typeof n === 'string').slice(0, 6) : []
      return NextResponse.json({
        suggestion: {
          title: str(p.title, 200), slug: str(p.slug, 80)?.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, ''),
          excerpt: str(p.excerpt, 600), seo_title: str(p.seo_title, 200), seo_description: str(p.seo_description, 400),
          content: str(p.content, 120_000), notes,
        },
      })
    } catch (err) {
      console.error('[admin/blog/spark] failed', err)
      return NextResponse.json({ error: friendlyAiError(err) }, { status: 502 })
    }
  },
  { rateLimit: { bucket: 'admin_blog_spark', max: 20, windowSeconds: 3600, identifierType: 'user' } },
)
