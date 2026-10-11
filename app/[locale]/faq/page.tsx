import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { pageAlternates } from '@/lib/seo/site'
import FAQClient from './FAQClient'

type Props = {
  params: { locale: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = params
  const t = await getTranslations({ locale, namespace: 'metadata' })

  return {
    title: `常見問題｜SPACE8 香港新蒲崗中式桌球室`,
    description: 'SPACE8 香港新蒲崗自助中式桌球室常見問題：預訂、會員、場地使用規則及更多資訊。',
    alternates: pageAlternates(locale, '/faq'),
  }
}

export default function FaqPage() {
  return <FAQClient />
}
