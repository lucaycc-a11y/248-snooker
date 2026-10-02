import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTopicData } from '@/lib/help/content-loader'
import { HelpTopicPage } from '@/components/help/HelpTopicPage'

interface Props {
  params: { locale: string; topic: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, topic } = params
  const topicData = await getTopicData(topic, locale === 'zh-HK' ? 'zh-Hant' : locale)

  if (!topicData) {
    return { title: 'Topic Not Found' }
  }

  return {
    title: `${topicData.title} - Help Center`,
    description: topicData.description,
  }
}

export const revalidate = 300

export default async function TopicPage({ params }: Props) {
  const { locale, topic } = params
  const topicData = await getTopicData(topic, locale === 'zh-HK' ? 'zh-Hant' : locale)

  if (!topicData) {
    notFound()
  }

  return <HelpTopicPage topicId={topic} topicData={topicData} />
}
