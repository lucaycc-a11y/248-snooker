import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getSearchableContent } from '@/lib/help/content-loader'
import { HelpSearchPage } from '@/components/help/HelpSearchPage'

interface Props {
  params: { locale: string }
  searchParams: { q?: string }
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'help' })
  const query = searchParams.q || ''

  const title = query
    ? `${t('metadata.search_title_with_query', { query })} - ${t('metadata.suffix_help_center')}`
    : `${t('metadata.search_title')} - ${t('metadata.suffix_help_center')}`

  return {
    title,
    description: t('metadata.search_description'),
  }
}

export const revalidate = 300

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = params
  const query = searchParams.q || ''

  const searchableItems = await getSearchableContent(
    locale === 'zh-HK' ? 'zh-Hant' : locale
  )

  return <HelpSearchPage searchableItems={searchableItems} initialQuery={query} />
}
