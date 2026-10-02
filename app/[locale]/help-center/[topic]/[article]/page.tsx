import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getArticle, getTopicData } from '@/lib/help/content-loader'
import { HelpArticlePage } from '@/components/help/HelpArticlePage'

interface Props {
  params: { locale: string; topic: string; article: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, topic, article } = params
  const articleData = await getArticle(topic, article, locale === 'zh-HK' ? 'zh-Hant' : locale)

  if (!articleData) {
    return { title: 'Article Not Found' }
  }

  return {
    title: `${articleData.title} - Help Center`,
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
