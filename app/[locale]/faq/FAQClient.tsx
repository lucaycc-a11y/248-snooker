'use client'

import HomeFAQ from '@/components/landing/HomeFAQ'
import NewMemberOfferNote from '@/components/seo/NewMemberOfferNote'

export default function FAQClient() {
  return (
    <div style={{ minHeight: '100vh', background: '#e8e8e8' }}>
      <HomeFAQ />
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '0 24px 48px' }}>
        <NewMemberOfferNote variant="faq" theme="light" />
      </div>
    </div>
  )
}
