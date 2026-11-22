import { getTranslations } from 'next-intl/server'
import { getPublicPricingPeriods, ratesSentence } from '@/lib/seo/public-pricing'

// Server-rendered, crawlable answer to "how much per hour?" (rates from config via
// getPublicPricingPeriods — never hardcoded). Shared by /faq and /pricing.
export default async function PriceFaqBlock({
  locale,
  tone = 'light',
}: {
  locale: string
  tone?: 'light' | 'dark'
}) {
  const periods = await getPublicPricingPeriods()
  if (periods.length === 0) return null
  const tPricing = await getTranslations({ locale, namespace: 'pricingPage' })
  const tSeo = await getTranslations({ locale, namespace: 'seoPricing' })
  const rates = ratesSentence(periods, (k, v) => tPricing(k, v), (k, v) => tSeo(k, v))
  const dark = tone === 'dark'
  return (
    <section
      aria-labelledby="price-faq-title"
      style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: '24px 20px',
        color: dark ? '#fff' : '#111',
      }}
    >
      <h2 id="price-faq-title" data-cms-key="seoPricing.faq_q" style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>
        {tSeo('faq_q')}
      </h2>
      <p data-cms-key="seoPricing.faq_a" style={{ fontSize: 16, lineHeight: 1.7, margin: 0 }}>
        {tSeo('faq_a', { rates })}
      </p>
    </section>
  )
}
