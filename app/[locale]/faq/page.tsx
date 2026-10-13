import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { pageAlternates, SITE_URL } from '@/lib/seo/site'
import { indexingMeta } from '@/lib/env/app-env'
import FAQClient from './FAQClient'

type Props = {
  params: { locale: string }
}

const TITLE = '常見問題｜SPACE8 香港新蒲崗中式桌球室'
const DESCRIPTION = 'SPACE8 香港新蒲崗自助中式桌球室常見問題：預訂、會員、場地使用規則及更多資訊。'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = params
  await getTranslations({ locale, namespace: 'metadata' })

  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: pageAlternates(locale, '/faq'),
    openGraph: {
      // og:title must match the title text exactly (SEO fix, post-launch).
      title: TITLE,
      description: DESCRIPTION,
      url: `${SITE_URL}${locale === 'zh-HK' ? '/faq' : `/${locale}/faq`}`,
      siteName: 'SPACE8',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: TITLE,
      description: DESCRIPTION,
    },
    robots: indexingMeta(),
  }
}

export default function FaqPage() {
  return <FAQClient />
}
