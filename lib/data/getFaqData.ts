import { getCMSList, type CMSListItem } from './getCMSList'
import { getFaqItems, type FaqItem } from '@/components/landing/faqData'

// FAQ items are addable/removable/reorderable (CMSList), not fixed keys
// (CMSText) — an admin can add a new FAQ or delete one. Falls back to the
// next-intl-derived list when cms_list_items has no rows yet for this
// locale (e.g. before the seed migration runs), so the page is never blank.

export type FaqFields = { question: string; answer: string }

export async function getFaqListData(
  locale: string,
  t: (key: string) => string
): Promise<CMSListItem<FaqFields>[]> {
  const items = await getCMSList<FaqFields>('faq', 'faq_items', locale)
  if (items.length > 0) return items

  const fallback: FaqItem[] = getFaqItems(t)
  return fallback.map((item, i) => ({
    id: item.id,
    orderIndex: i,
    fields: { question: item.question, answer: item.answer },
  }))
}

export function getFaqJsonLdFromItems(items: CMSListItem<FaqFields>[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.fields.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.fields.answer,
      },
    })),
  }
}
