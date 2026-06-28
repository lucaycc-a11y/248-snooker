import { MetadataRoute } from 'next'

const BASE = 'https://248.formhk.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
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
  ]
}
