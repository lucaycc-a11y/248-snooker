import { getBlogPosts } from '@/lib/data/getBlog'

const BASE = 'https://space8.com.hk'
const LOCALES = ['zh-HK', 'zh-CN', 'en']

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export const revalidate = 3600

export async function GET(_req: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!LOCALES.includes(locale)) return new Response('Not found', { status: 404 })
  const prefix = locale === 'zh-HK' ? '' : `/${locale}`
  const posts = (await getBlogPosts(locale)).slice().sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? '')).slice(0, 50)

  const items = posts
    .map((p) => {
      const link = `${BASE}${prefix}/blog/${p.slug}`
      return `<item><title>${esc(p.title)}</title><link>${link}</link><guid isPermaLink="true">${link}</guid>${
        p.published_at ? `<pubDate>${new Date(p.published_at).toUTCString()}</pubDate>` : ''
      }${p.category ? `<category>${esc(p.category)}</category>` : ''}<description>${esc(p.excerpt ?? '')}</description></item>`
    })
    .join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Space8 Blog</title><link>${BASE}${prefix}/blog</link><description>Space8 — 新蒲崗自助桌球室</description><language>${locale}</language><atom:link href="${BASE}${prefix}/blog/feed.xml" rel="self" type="application/rss+xml"/>${items}</channel></rss>`
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } })
}
