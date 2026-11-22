import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import Nav from '@/components/layout/Nav'
import Footer from '@/components/layout/Footer'
import PriceFaqBlock from '@/components/pricing/PriceFaqBlock'
import { indexingMeta } from '@/lib/env/app-env'
import { pageAlternates, SITE_URL } from '@/lib/seo/site'
import { buildPricingOffersJsonLd, safeJsonLd } from '@/lib/seo/jsonLd'
import { getPublicPricingPeriods, lowestPublicRate, ratesSentence } from '@/lib/seo/public-pricing'
import { periodsToSlots } from '@/lib/ui/pricing-adapter'

// Rates come from the config table (see lib/seo/public-pricing.ts); revalidate with
// the 5-minute cache so a go-live reaches this page without a deploy.
export const revalidate = 300

const PricingCards = dynamic(() => import('@/components/ui/pricing-cards'), { ssr: true })

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const tSeo = await getTranslations({ locale, namespace: 'seoPricing' })
  const min = lowestPublicRate(await getPublicPricingPeriods())
  const title = tSeo('page_title')
  const description = min != null ? tSeo('page_desc', { minRate: String(min) }) : title
  const path = locale === 'zh-HK' ? '/pricing' : `/${locale}/pricing`
  return {
    title,
    description,
    alternates: pageAlternates(locale, '/pricing'),
    openGraph: { title, description, url: `${SITE_URL}${path}`, siteName: 'SPACE8', type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
    robots: indexingMeta(),
  }
}

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  const periods = await getPublicPricingPeriods()
  const tPricing = await getTranslations({ locale, namespace: 'pricingPage' })
  const tCombo = await getTranslations({ locale, namespace: 'combo' })
  const tSeo = await getTranslations({ locale, namespace: 'seoPricing' })
  const min = lowestPublicRate(periods)
  const slots = periodsToSlots(periods, (k, v) => tPricing(k, v), (k, v) => tCombo(k, v))
  const hasCombo = slots.some((s) => s.comboLabel != null)

  const offersJsonLd = buildPricingOffersJsonLd(periods, {
    name: (id) => tPricing(`period_${id}_title`),
    description: (p) => `${tPricing(`period_${p.id}_time`)} ${tPricing('per_hour')}`,
  })
  const rates = ratesSentence(periods, (k, v) => tPricing(k, v), (k, v) => tSeo(k, v))
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: tSeo('faq_q'),
        acceptedAnswer: { '@type': 'Answer', text: tSeo('faq_a', { rates }) },
      },
    ],
  }

  return (
    <main className="relative bg-black" style={{ isolation: 'isolate' }}>
      <Nav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(offersJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }} />
      <header style={{ maxWidth: 960, margin: '0 auto', padding: 'calc(var(--nav-h, 4rem) + 3rem) 20px 0', color: '#fff' }}>
        <h1 data-cms-key="seoPricing.h1" style={{ fontSize: 36, fontWeight: 800, margin: '0 0 12px' }}>
          {tSeo('h1')}
        </h1>
        {min != null ? (
          <p data-cms-key="seoPricing.intro" style={{ fontSize: 16, lineHeight: 1.7, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
            {tSeo('intro', { minRate: String(min) })}
          </p>
        ) : null}
      </header>
      <PricingCards
        theme="light"
        heading={hasCombo ? tCombo('title') : tPricing('periods_title')}
        subheading={hasCombo ? tCombo('note_tagline') : tPricing('periods_subtitle')}
        slots={slots}
        footnote={hasCombo ? tCombo('footnote') : undefined}
      />
      <div style={{ background: '#e8e8e8' }}>
        <PriceFaqBlock locale={locale} />
      </div>
      <Footer />
    </main>
  )
}
