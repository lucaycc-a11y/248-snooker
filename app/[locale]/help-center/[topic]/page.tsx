import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import dynamic from 'next/dynamic'
import { getTranslations } from 'next-intl/server'
import { getTopicData, getAllTopics } from '@/lib/help/content-loader'

// ── Main content (lazy load) ────────────────────────────────────────────────
const HelpTopicPage = dynamic(
  () => import('@/components/help/HelpTopicPage').then(mod => ({ default: mod.HelpTopicPage })),
  { ssr: true }
)

interface Props {
  params: { locale: string; topic: string }
}

export async function generateStaticParams() {
  const topics = await getAllTopics()
  const locales = ['zh-HK', 'zh-CN', 'en', 'ja']

  return locales.flatMap((locale) =>
    topics.map((topic) => ({
      locale,
      topic,
    }))
  )
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, topic } = params
  const t = await getTranslations({ locale, namespace: 'help' })
  const topicData = await getTopicData(topic, locale === 'zh-HK' ? 'zh-Hant' : locale)

  if (!topicData) {
    return { title: t('metadata.topic_not_found') }
  }

  return {
    title: `${topicData.title} - ${t('metadata.suffix_help_center')}`,
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
