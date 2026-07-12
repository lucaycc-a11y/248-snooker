import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api', '/auth', '/member'],
    },
    sitemap: 'https://space8.com.hk/sitemap.xml',
  }
}
