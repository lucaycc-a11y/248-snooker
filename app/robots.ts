import { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { unstable_noStore as noStore } from 'next/cache'
import { getSiteGate } from '@/lib/gate/config'
import { isProductionHost, SITE_URL } from '@/lib/seo/site'

// Rendered per request: the gate flag and the Host header both decide the
// output, so a build-time or data-cached robots.txt could keep serving
// `Disallow: /` after the gate is switched off.
export const dynamic = 'force-dynamic'
export const revalidate = 0

const DISALLOW_ALL: MetadataRoute.Robots = { rules: { userAgent: '*', disallow: '/' } }
// Private, never-indexable areas. Pages that are merely `noindex`
// (/coming-soon, /maintenance, /uat-gate) are deliberately NOT disallowed:
// a Disallow would stop crawlers from fetching them and seeing the noindex.
const PRIVATE_PATHS = ['/admin', '/api', '/auth', '/member', '/login', '/reset-password', '/book/checkout', '/book/confirm']

// AI crawlers that respect robots.txt opt-in — explicitly allowed for GEO
// (generative engine visibility in ChatGPT/Perplexity/Google AI Overview,
// Claude, Apple Intelligence). ChatGPT-User / Claude-Web are the live-fetch
// agents (used when a user asks the assistant about us in real time);
// GPTBot / ClaudeBot / CCBot are the training/index crawlers; Google-Extended
// and Applebot-Extended gate Gemini / Apple Intelligence generative use.
const AI_USER_AGENTS = [
  'GPTBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-Web',
  'PerplexityBot',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
]

export default async function robots(): Promise<MetadataRoute.Robots> {
  noStore()

  // Only the production host may be crawled. uat.space8.com.hk shares the
  // gate row with production, so without this it would become crawlable
  // duplicate content the moment the gate goes off.
  if (!isProductionHost(headers().get('host'))) return DISALLOW_ALL

  // While the pre-launch site gate is on, every real page 302s to
  // /coming-soon for any crawler without a bypass cookie — so robots.txt
  // must not advertise a full sitemap as indexable, or search engines may
  // index/deindex based on a redirect chain instead of real content.
  const { config } = await getSiteGate()
  if (config.enabled) return DISALLOW_ALL

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: PRIVATE_PATHS,
      },
      ...AI_USER_AGENTS.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: PRIVATE_PATHS,
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
