import { MetadataRoute } from 'next'
import { getBlogPosts } from '@/lib/data/getBlog'

const BASE = 'https://space8.com.hk'
const LOCALES = ['zh-HK', 'zh-CN', 'en']

function localePath(locale: string, path: string): string {
  return locale === 'zh-HK' ? path : `/${locale}${path}`
}

// Full 4-locale + x-default hreflang alternates for a given root path (e.g.
// '/', '/pricing'). Previously only zh-HK + a nonstandard 'en-HK' code were
// listed here, missing zh-CN/ja entirely despite LOCALES covering all 4 —
// inconsistent with the per-page generateMetadata functions.
function alternatesFor(path: string) {
  const languages = Object.fromEntries(LOCALES.map((locale) => [locale, `${BASE}${localePath(locale, path)}`]))
  return { languages: { ...languages, 'x-default': `${BASE}${path}` } }
}

function staticEntry(
  path: string,
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
  priority: number,
  now: Date,
): MetadataRoute.Sitemap[number] {
  return {
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
    alternates: alternatesFor(path),
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const postsByLocale = await Promise.all(LOCALES.map((locale) => getBlogPosts(locale)))
  const postEntries: MetadataRoute.Sitemap = postsByLocale.flatMap((posts, i) =>
    posts.map((post) => ({
      url: `${BASE}${localePath(LOCALES[i], `/blog/${post.slug}`)}`,
      lastModified: post.published_at ? new Date(post.published_at) : now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
      // NOTE: no hreflang alternates here — blog posts are per-locale rows with
      // independent slugs (getBlogPosts filters by locale), so a slug in one
      // locale is not guaranteed to resolve under another locale's prefix.
      // Advertising cross-locale alternates could point at 404s.
    }))
  )

  return [
    staticEntry('/', 'weekly', 1, now),
    staticEntry('/book', 'daily', 0.9, now),
    staticEntry('/pricing', 'weekly', 0.8, now),
    staticEntry('/venue', 'monthly', 0.7, now),
    staticEntry('/membership', 'monthly', 0.7, now),
    staticEntry('/about', 'monthly', 0.6, now),
    staticEntry('/faq', 'monthly', 0.6, now),
    staticEntry('/blog', 'weekly', 0.7, now),
    staticEntry('/legal', 'yearly', 0.3, now),
    ...postEntries,
  ]
}
