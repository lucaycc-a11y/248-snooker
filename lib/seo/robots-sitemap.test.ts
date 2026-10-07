import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- mocks ---------------------------------------------------------------
const gate = { enabled: true }
let host: string | null = 'space8.com.hk'

vi.mock('next/headers', () => ({
  headers: () => ({ get: (name: string) => (name.toLowerCase() === 'host' ? host : null) }),
}))
vi.mock('next/cache', () => ({ unstable_noStore: () => undefined }))
vi.mock('@/lib/gate/config', () => ({
  getSiteGate: async () => ({
    config: { enabled: gate.enabled, passwordHash: null, passwordSalt: null, passwordVersion: 1 },
    whitelist: [],
  }),
}))
vi.mock('@/lib/data/getBlog', () => ({ getBlogPosts: async () => [] }))
vi.mock('@/lib/help/content-loader', () => ({
  getHelpContent: async () => ({
    topics_data: {
      booking: {
        articles: [
          { id: 'how-to-book', published: true },
          { id: 'draft', published: false },
          { id: 'gated', published: true, gate: 'points' },
        ],
      },
    },
  }),
}))

import robots from '@/app/robots'
import { buildSitemapEntries, renderSitemapXml, STATIC_PAGES } from '@/lib/seo/sitemap'
import { IMAGE_MANIFEST } from '@/lib/seo/imageManifest'
import { isProductionHost, hreflangLanguages, pageAlternates } from '@/lib/seo/site'

type Rule = { userAgent?: string | string[]; allow?: string | string[]; disallow?: string | string[] }
function rulesOf(r: Awaited<ReturnType<typeof robots>>): Rule[] {
  return Array.isArray(r.rules) ? r.rules : [r.rules]
}
function isDisallowAll(r: Awaited<ReturnType<typeof robots>>): boolean {
  const rules = rulesOf(r)
  return rules.length === 1 && rules[0].userAgent === '*' && rules[0].disallow === '/' && !r.sitemap
}

beforeEach(() => {
  gate.enabled = true
  host = 'space8.com.hk'
})

describe('robots.txt', () => {
  it('gate on → Disallow all, no sitemap', async () => {
    expect(isDisallowAll(await robots())).toBe(true)
  })

  it('gate off on space8.com.hk → Allow / with sitemap, private paths disallowed', async () => {
    gate.enabled = false
    const r = await robots()
    expect(isDisallowAll(r)).toBe(false)
    expect(r.sitemap).toBe('https://space8.com.hk/sitemap.xml')
    const star = rulesOf(r).find((x) => x.userAgent === '*')
    expect(star?.allow).toBe('/')
    for (const p of ['/member', '/login', '/admin', '/auth', '/api']) {
      expect(star?.disallow).toContain(p)
    }
    // noindex pages must stay crawlable so the noindex is seen
    expect(star?.disallow).not.toContain('/coming-soon')
  })

  it('gate off on www.space8.com.hk → treated as production', async () => {
    gate.enabled = false
    host = 'www.space8.com.hk'
    expect(isDisallowAll(await robots())).toBe(false)
  })

  it.each(['uat.space8.com.hk', '248-snooker-git-uat-team.vercel.app', 'localhost:3000', null])(
    'gate off on %s → Disallow all',
    async (h) => {
      gate.enabled = false
      host = h
      expect(isDisallowAll(await robots())).toBe(true)
    },
  )
})

describe('sitemap.xml', () => {
  it('gate on → empty', async () => {
    expect(await buildSitemapEntries()).toEqual([])
    expect(renderSitemapXml([])).not.toContain('<url>')
  })

  it('gate off → every public page, help articles, manifest images; no private paths', async () => {
    gate.enabled = false
    const entries = await buildSitemapEntries()
    const urls = entries.map((e) => e.url)
    for (const [path] of STATIC_PAGES) {
      expect(urls).toContain(path === '/' ? 'https://space8.com.hk' : `https://space8.com.hk${path}`)
    }
    expect(urls).toContain('https://space8.com.hk/help-center/booking/how-to-book')
    expect(urls).not.toContain('https://space8.com.hk/help-center/booking/draft')
    expect(urls).not.toContain('https://space8.com.hk/help-center/booking/gated')
    expect(urls.some((u) => /\/(member|login|admin|auth|faq)(\/|$)/.test(u))).toBe(false)

    const xml = renderSitemapXml(entries)
    expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"')
    const imageLocs = [...xml.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)].map((m) => m[1])
    // every manifest photo is referenced by at least one page entry, URL-encoded
    for (const img of IMAGE_MANIFEST) {
      expect(imageLocs).toContain(`https://space8.com.hk${encodeURI(img.src)}`)
    }
    expect(imageLocs.every((u) => /^https:\/\/space8\.com\.hk\/[\x21-\x7e]+$/.test(u))).toBe(true)
    // only enabled locales in hreflang
    expect(xml).not.toMatch(/hreflang="(zh-CN|en|ja)"/)
  })
})

describe('lib/seo/site', () => {
  it('isProductionHost', () => {
    expect(isProductionHost('space8.com.hk')).toBe(true)
    expect(isProductionHost('SPACE8.com.hk:443')).toBe(true)
    expect(isProductionHost('www.space8.com.hk')).toBe(true)
    expect(isProductionHost('uat.space8.com.hk')).toBe(false)
    expect(isProductionHost('space8.com.hk.evil.com')).toBe(false)
  })

  it('hreflang only advertises enabled locales + x-default', () => {
    expect(hreflangLanguages('/venue')).toEqual({
      'zh-HK': 'https://space8.com.hk/venue',
      'x-default': 'https://space8.com.hk/venue',
    })
    expect(pageAlternates('zh-HK', '/')).toEqual({
      canonical: 'https://space8.com.hk',
      languages: { 'zh-HK': 'https://space8.com.hk', 'x-default': 'https://space8.com.hk' },
    })
  })
})
