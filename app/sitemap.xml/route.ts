import { unstable_noStore as noStore } from 'next/cache'
import { buildSitemapEntries, renderSitemapXml } from '@/lib/seo/sitemap'

// Rendered per request so switching the gate off takes effect immediately,
// instead of a build-time / data-cached empty sitemap lingering.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(): Promise<Response> {
  noStore()
  const xml = renderSitemapXml(await buildSitemapEntries())
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
