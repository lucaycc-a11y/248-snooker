import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getHelpContent } from '@/lib/help/content-loader'
import { HelpAnnouncementPage } from '@/components/help/HelpAnnouncementPage'

interface Props {
  params: { locale: string; slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = params
  const content = await getHelpContent(locale === 'zh-HK' ? 'zh-Hant' : locale)

  const announcement = content.announcements.find((a) => a.id === slug)

  if (!announcement) {
    return { title: 'Announcement Not Found' }
  }

  return {
    title: `${announcement.title} - 幫助中心`,
    description: announcement.summary,
  }
}

export const revalidate = 300

export default async function AnnouncementPage({ params }: Props) {
  const { locale, slug } = params
  const content = await getHelpContent(locale === 'zh-HK' ? 'zh-Hant' : locale)

  const announcement = content.announcements.find((a) => a.id === slug)

  if (!announcement) {
    notFound()
  }

  return <HelpAnnouncementPage announcement={announcement} />
}
