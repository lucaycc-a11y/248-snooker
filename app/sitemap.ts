import { MetadataRoute } from 'next'
import { getBlogPosts } from '@/lib/data/getBlog'

const BASE = 'https://space8.com.hk'
const LOCALES = ['zh-HK', 'zh-CN', 'en', 'ja']

function localePath(locale: string, slug: string): string {
  return locale === 'zh-HK' ? `/blog/${slug}` : `/${locale}/blog/${slug}`
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const postsByLocale = await Promise.all(LOCALES.map((locale) => getBlogPosts(locale)))
  const postEntries: MetadataRoute.Sitemap = postsByLocale.flatMap((posts, i) =>
    posts.map((post) => ({
      url: `${BASE}${localePath(LOCALES[i], post.slug)}`,
      lastModified: post.published_at ? new Date(post.published_at) : now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }))
  )

  return [
    {
      url: BASE,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
      alternates: {
        languages: {
          'zh-HK': BASE,
          'en-HK': `${BASE}/en`,
        },
      },
    },
    {
      url: `${BASE}/book`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
      alternates: {
        languages: {
          'zh-HK': `${BASE}/book`,
          'en-HK': `${BASE}/en/book`,
        },
      },
    },
    {
      url: `${BASE}/pricing`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
      alternates: {
        languages: {
          'zh-HK': `${BASE}/pricing`,
          'en-HK': `${BASE}/en/pricing`,
        },
      },
    },
    {
      url: `${BASE}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
      alternates: {
        languages: {
          'zh-HK': `${BASE}/about`,
          'en-HK': `${BASE}/en/about`,
        },
      },
    },
    {
      url: `${BASE}/faq`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
      alternates: {
        languages: {
          'zh-HK': `${BASE}/faq`,
          'en-HK': `${BASE}/en/faq`,
        },
      },
    },
    {
      url: `${BASE}/blog`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
      alternates: {
        languages: {
          'zh-HK': `${BASE}/blog`,
          'en-HK': `${BASE}/en/blog`,
        },
      },
    },
    {
      url: `${BASE}/legal`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
      alternates: {
        languages: {
          'zh-HK': `${BASE}/legal`,
          'en-HK': `${BASE}/en/legal`,
        },
      },
    },
    ...postEntries,
  ]
}
