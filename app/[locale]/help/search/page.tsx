import { Metadata } from 'next'
import { getSearchableContent } from '@/lib/help/content-loader'
import { HelpSearchPage } from '@/components/help/HelpSearchPage'

interface Props {
  params: { locale: string }
  searchParams: { q?: string }
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const query = searchParams.q || ''
  return {
    title: query ? `搜尋：${query} - 幫助中心` : '搜尋 - 幫助中心',
    description: '搜尋 Space8 幫助文章和常見問題',
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
