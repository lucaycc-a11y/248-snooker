import { Metadata } from 'next'
import { pageAlternates } from "@/lib/seo/site";
import { getTranslations } from 'next-intl/server'
import dynamic from 'next/dynamic'
import { getHelpContent } from '@/lib/help/content-loader'

// ── Main content (lazy load) ────────────────────────────────────────────────
const HelpHome = dynamic(
  () => import('@/components/help/HelpHome').then(mod => ({ default: mod.HelpHome })),
  { ssr: true }
)

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const { locale } = params
  const t = await getTranslations({ locale, namespace: 'help' })

  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: pageAlternates(locale, '/help-center'),
  }
}

export const revalidate = 300 // ISR: 5 minutes

export default async function HelpPage({ params }: { params: { locale: string } }) {
  const { locale } = params
  const content = await getHelpContent(locale === 'zh-HK' ? 'zh-Hant' : locale)

  return <HelpHome content={content} />
}
