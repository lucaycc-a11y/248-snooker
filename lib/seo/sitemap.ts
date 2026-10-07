import { getBlogPosts } from '@/lib/data/getBlog'
import { getSiteGate } from '@/lib/gate/config'
import { getHelpContent } from '@/lib/help/content-loader'
import { ENABLED_LOCALES } from '@/i18n/enabled-locales'
import { absoluteUrl, hreflangLanguages, SITE_URL } from '@/lib/seo/site'
import { imagesForPage } from '@/lib/seo/imageManifest'

// Built by hand instead of app/sitemap.ts: Next 14.2's MetadataRoute.Sitemap
// serializer has no image support (an `images` field is silently dropped),
// and Google Images discovery needs <image:image> entries.

type ChangeFrequency = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'

export type SitemapEntry = {
  url: string
  lastModified: Date
  changeFrequency: ChangeFrequency
  priority: number
  languages?: Record<string, string>
  images?: string[]
}

// Absolute, percent-encoded image URL (filenames contain Chinese characters).
export function imageUrl(src: string): string {
  return `${SITE_URL}${encodeURI(src)}`
}

function staticEntry(path: string, changeFrequency: ChangeFrequency, priority: number, now: Date): SitemapEntry {
  const images = imagesForPage(path).map((img) => imageUrl(img.src))
  return {
    url: absoluteUrl(ENABLED_LOCALES[0], path),
    lastModified: now,
    changeFrequency,
    priority,
    languages: hreflangLanguages(path),
    ...(images.length > 0 && { images }),
  }
}

async function helpCenterEntries(now: Date): Promise<SitemapEntry[]> {
  const content = await getHelpContent('zh-Hant')
  return Object.entries(content.topics_data).flatMap(([topic, data]) => [
    { url: absoluteUrl(ENABLED_LOCALES[0], `/help-center/${topic}`), lastModified: now, changeFrequency: 'monthly' as const, priority: 0.5 },
    ...data.articles
      .filter((a) => a.published && !a.gate)
      .map((a) => ({
        url: absoluteUrl(ENABLED_LOCALES[0], `/help-center/${topic}/${a.id}`),
        lastModified: now,
        changeFrequency: 'monthly' as const,
        priority: 0.4,
      })),
  ])
}

// Public, indexable pages. /faq is a 308 to /help-center (next.config.js), so
// only the target is listed. /login, /member, /admin, /auth and booking steps
// are private and never listed.
export const STATIC_PAGES: Array<[path: string, freq: ChangeFrequency, priority: number]> = [
  ['/', 'weekly', 1],
  ['/book', 'daily', 0.9],
  ['/venue', 'monthly', 0.8],
  ['/membership', 'monthly', 0.7],
  ['/about', 'monthly', 0.7],
  ['/help-center', 'monthly', 0.6],
  ['/blog', 'weekly', 0.6],
  ['/credits', 'yearly', 0.3],
  ['/legal', 'yearly', 0.3],
]

export async function buildSitemapEntries(): Promise<SitemapEntry[]> {
  // While the pre-launch gate is on every page redirects to /coming-soon, so
  // nothing is advertised.
  const { config } = await getSiteGate()
  if (config.enabled) return []

  const now = new Date()

  const postsByLocale = await Promise.all(ENABLED_LOCALES.map((locale) => getBlogPosts(locale)))
  const postEntries: SitemapEntry[] = postsByLocale.flatMap((posts, i) =>
    posts.map((post) => ({
      url: absoluteUrl(ENABLED_LOCALES[i], `/blog/${post.slug}`),
      lastModified: post.published_at ? new Date(post.published_at) : now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
      // NOTE: no hreflang alternates here — blog posts are per-locale rows with
      // independent slugs (getBlogPosts filters by locale), so a slug in one
      // locale is not guaranteed to resolve under another locale's prefix.
      // Advertising cross-locale alternates could point at 404s.
      ...(post.cover_image_url?.startsWith('http') && { images: [post.cover_image_url] }),
    }))
  )

  // A Help Center read failure must not drop the core pages from the sitemap.
  let helpEntries: SitemapEntry[] = []
  try {
    helpEntries = await helpCenterEntries(now)
  } catch (err) {
    console.error('[sitemap] help center entries failed', err)
  }

  return [
    ...STATIC_PAGES.map(([path, freq, priority]) => staticEntry(path, freq, priority, now)),
    ...helpEntries,
    ...postEntries,
  ]
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function renderSitemapXml(entries: SitemapEntry[]): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
  ]
  for (const e of entries) {
    lines.push('<url>', `<loc>${xmlEscape(e.url)}</loc>`)
    for (const [lang, href] of Object.entries(e.languages ?? {})) {
      lines.push(`<xhtml:link rel="alternate" hreflang="${xmlEscape(lang)}" href="${xmlEscape(href)}" />`)
    }
    lines.push(
      `<lastmod>${e.lastModified.toISOString()}</lastmod>`,
      `<changefreq>${e.changeFrequency}</changefreq>`,
      `<priority>${e.priority}</priority>`,
    )
    for (const img of e.images ?? []) {
      lines.push(`<image:image><image:loc>${xmlEscape(img)}</image:loc></image:image>`)
    }
    lines.push('</url>')
  }
  lines.push('</urlset>', '')
  return lines.join('\n')
}
