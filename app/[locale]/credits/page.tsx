import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import Nav from '@/components/layout/Nav'
import Footer from '@/components/layout/Footer'
import WhatsAppButton from '@/components/shared/WhatsAppButton'
import CreditsContent from './CreditsContent'

const BASE = 'https://space8.com.hk'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const path = locale === 'zh-HK' ? '/credits' : `/${locale}/credits`

  const meta: Record<string, { title: string; description: string }> = {
    'zh-HK': {
      title: '製作團隊｜SPACE8 無煙中八球室',
      description: 'SPACE8 網站製作團隊 — 設計、開發、攝影。',
    },
    'zh-CN': {
      title: '制作团队｜SPACE8 无烟中式八球室',
      description: 'SPACE8 网站制作团队 — 设计、开发、摄影。',
    },
    en: {
      title: 'Credits｜SPACE8 Smoke-Free Chinese Eight-Ball Club',
      description: 'The team behind the SPACE8 website — design, development, photography.',
    },
  }
  const m = meta[locale] ?? meta['zh-HK']

  return {
    title: m.title,
    description: m.description,
    alternates: {
      canonical: `${BASE}${path}`,
      languages: {
        'zh-HK': `${BASE}/credits`,
        'zh-CN': `${BASE}/zh-CN/credits`,
        en: `${BASE}/en/credits`,
        'x-default': `${BASE}/credits`,
      },
    },
    openGraph: {
      title: m.title,
      description: m.description,
      url: `${BASE}${path}`,
      siteName: 'Space8',
      type: 'website',
    },
    robots: { index: true, follow: true },
  }
}

export default async function CreditsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <main className="relative bg-black">
      <Nav />
      <CreditsContent />
      <Footer />
      <WhatsAppButton />
    </main>
  )
}