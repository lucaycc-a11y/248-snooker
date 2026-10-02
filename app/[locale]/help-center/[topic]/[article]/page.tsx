import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import dynamic from 'next/dynamic'
import { getTranslations } from 'next-intl/server'
import { getArticle, getTopicData, getAllTopics, getAllArticles } from '@/lib/help/content-loader'

// ── Main content (lazy load) ────────────────────────────────────────────────
const HelpArticlePage = dynamic(
  () => import('@/components/help/HelpArticlePage').then(mod => ({ default: mod.HelpArticlePage })),
  { ssr: true }
)

interface Props {
  params: { locale: string; topic: string; article: string }
}

export async function generateStaticParams() {
  const topics = await getAllTopics()
  const locales = ['zh-HK', 'zh-CN', 'en', 'ja']

  const params = []
  for (const topic of topics) {
    const articles = await getAllArticles(topic)
    for (const locale of locales) {
      for (const article of articles) {
        params.push({ locale, topic, article })
      }
    }
  }
  return params
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, topic, article } = params
  const t = await getTranslations({ locale, namespace: 'help' })
  const articleData = await getArticle(topic, article, locale === 'zh-HK' ? 'zh-Hant' : locale)

  if (!articleData) {
    return { title: t('metadata.article_not_found') }
  }

  return {
    title: `${articleData.title} - ${t('metadata.suffix_help_center')}`,
    description: articleData.summary,
  }
}

export const revalidate = 300

export default async function ArticlePage({ params }: Props) {
  const { locale, topic, article } = params
  const [articleData, topicData] = await Promise.all([
    getArticle(topic, article, locale === 'zh-HK' ? 'zh-Hant' : locale),
    getTopicData(topic, locale === 'zh-HK' ? 'zh-Hant' : locale),
  ])

  if (!articleData || !topicData) {
    notFound()
  }

  return (
    <HelpArticlePage
      topicId={topic}
      topicTitle={topicData.title}
      article={articleData}
      allArticles={topicData.articles.filter((a) => a.published)}
    />
  )
}
