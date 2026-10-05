import { MetadataRoute } from 'next'
import { getBlogPosts } from '@/lib/data/getBlog'
import { getSiteGate } from '@/lib/gate/config'
import { ENABLED_LOCALES, DEFAULT_LOCALE } from '@/i18n/enabled-locales'

const BASE = 'https://space8.com.hk'

function localePath(locale: string, path: string): string {
  return locale === DEFAULT_LOCALE ? path : `/${locale}${path}`
}

// hreflang alternates for enabled locales only
function alternatesFor(path: string) {
  const languages = Object.fromEntries(
    ENABLED_LOCALES.map((locale) => [locale, `${BASE}${localePath(locale, path)}`])
  )
  return { languages: { ...languages, 'x-default': `${BASE}${path}` } }
}

function staticEntry(
  path: string,
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
  priority: number,
  now: Date,
  images?: { url: string }[]
): MetadataRoute.Sitemap[number] {
  return {
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
    alternates: alternatesFor(path),
    ...(images && { images }),
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { config } = await getSiteGate()
  if (config.enabled) return []

  const now = new Date()

  const postsByLocale = await Promise.all(ENABLED_LOCALES.map((locale) => getBlogPosts(locale)))
  const postEntries: MetadataRoute.Sitemap = postsByLocale.flatMap((posts, i) =>
    posts.map((post) => ({
      url: `${BASE}${localePath(ENABLED_LOCALES[i], `/blog/${post.slug}`)}`,
      lastModified: post.published_at ? new Date(post.published_at) : now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
      // NOTE: no hreflang alternates here — blog posts are per-locale rows with
      // independent slugs (getBlogPosts filters by locale), so a slug in one
      // locale is not guaranteed to resolve under another locale's prefix.
      // Advertising cross-locale alternates could point at 404s.
    }))
  )

  // Venue page images (9 non-clean panorama images for Room Viewer section)
  const venueImages = [
    'space8-infinity-room-chinese-eight-ball-table-san-po-kong.webp',
    'space8-eternity-room-chinese-eight-ball-table-san-po-kong.webp',
    'space8-infinity-room-lounge-sofa-armchair-side-table.webp',
    'space8-eternity-room-lounge-black-sofa.webp',
    'space8-eternity-room-bar-counter-black-stools.webp',
    'xing-pai-chinese-eight-ball-table-corner-pocket-hong-kong.webp',
    'super-aramith-pro-tv-pro-cup-billiard-balls-space8.webp',
    'triangle-chalk-billiard-cue-chalk-space8.webp',
    'space8-cue-rack-professional-cues-close-up.webp',
  ].map((file) => ({ url: `${BASE}/images/${file}` }))

  return [
    staticEntry('/', 'weekly', 1, now),
    staticEntry('/book', 'daily', 0.9, now),
    staticEntry('/venue', 'monthly', 0.7, now, venueImages),
    staticEntry('/membership', 'monthly', 0.7, now),
    staticEntry('/about', 'monthly', 0.6, now),
    staticEntry('/faq', 'monthly', 0.6, now),
    staticEntry('/blog', 'weekly', 0.7, now),
    staticEntry('/legal', 'yearly', 0.3, now),
    ...postEntries,
  ]
}
