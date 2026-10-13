import { Metadata } from 'next'
import { pageAlternates } from '@/lib/seo/site'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getHelpContent, getAllAnnouncementIds } from '@/lib/help/content-loader'
import { HelpAnnouncementPage } from '@/components/help/HelpAnnouncementPage'

interface Props {
  params: { locale: string; slug: string }
}

export async function generateStaticParams() {
  const announcementIds = await getAllAnnouncementIds()
  const locales = ['zh-HK', 'zh-CN', 'en', 'ja']

  return locales.flatMap((locale) =>
    announcementIds.map((slug) => ({
      locale,
      slug,
    }))
  )
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = params
  const t = await getTranslations({ locale, namespace: 'help' })
  const content = await getHelpContent(locale === 'zh-HK' ? 'zh-Hant' : locale)

  const announcement = content.announcements.find((a) => a.id === slug)

  if (!announcement) {
    return { title: t('metadata.announcement_not_found') }
  }

  return {
    title: `${announcement.title} - ${t('metadata.suffix_help_center')}`,
    description: announcement.summary,
    alternates: pageAlternates(locale, `/help-center/announcements/${slug}`, { hreflang: false }),
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
