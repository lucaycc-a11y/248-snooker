import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getHelpContent } from '@/lib/help/content-loader'
import { HelpHome } from '@/components/help/HelpHome'

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const { locale } = params
  const t = await getTranslations({ locale, namespace: 'help' })

  return {
    title: t('meta.title'),
    description: t('meta.description'),
  }
}

export const revalidate = 300 // ISR: 5 minutes

export default async function HelpPage({ params }: { params: { locale: string } }) {
  const { locale } = params
  const content = await getHelpContent(locale === 'zh-HK' ? 'zh-Hant' : locale)

  return <HelpHome content={content} />
}
