import { MetadataRoute } from 'next'
import { getSiteGate } from '@/lib/gate/config'

// AI crawlers that respect robots.txt opt-in — explicitly allowed for GEO
// (generative engine visibility in ChatGPT/Perplexity/Google AI Overview).
const AI_USER_AGENTS = ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'CCBot']

export default async function robots(): Promise<MetadataRoute.Robots> {
  // While the pre-launch site gate is on, every real page 302s to
  // /coming-soon for any crawler without a bypass cookie — so robots.txt
  // must not advertise a full sitemap as indexable, or search engines may
  // index/deindex based on a redirect chain instead of real content.
  const { config } = await getSiteGate()
  if (config.enabled) {
    return {
      rules: { userAgent: '*', disallow: '/' },
    }
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api', '/auth', '/member'],
      },
      ...AI_USER_AGENTS.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: ['/admin', '/api', '/auth', '/member'],
      })),
    ],
    sitemap: 'https://space8.com.hk/sitemap.xml',
  }
}
