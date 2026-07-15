import { getCMSGrouped } from '@/lib/data/getAdminCMS'
import { getCMSList } from '@/lib/data/getCMSList'
import CMSEditor from '@/components/admin/CMSEditor'
import { tokens } from '@/app/styles/tokens'

const DEFAULT_LOCALE = 'zh-HK'

const KNOWN_LISTS: { title: string; page: string; collectionKey: string; fieldNames: [string, string] }[] = [
  { title: 'FAQ items', page: 'faq', collectionKey: 'faq_items', fieldNames: ['question', 'answer'] },
  { title: 'Legal — Terms sections', page: 'legal', collectionKey: 'terms_sections', fieldNames: ['title', 'body'] },
  { title: 'Legal — Website terms sections', page: 'legal', collectionKey: 'website_terms_sections', fieldNames: ['title', 'body'] },
  { title: 'Legal — Privacy sections', page: 'legal', collectionKey: 'privacy_sections', fieldNames: ['title', 'body'] },
]

export default async function AdminCMSPage() {
  const [groups, ...listResults] = await Promise.all([
    getCMSGrouped(DEFAULT_LOCALE),
    ...KNOWN_LISTS.map((l) => getCMSList<Record<string, string>>(l.page, l.collectionKey, DEFAULT_LOCALE)),
  ])
  const lists = KNOWN_LISTS.map((l, i) => ({ ...l, items: listResults[i] }))

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: tokens.colors.text, marginBottom: 24 }}>Content</h1>
      <CMSEditor groups={groups} locale={DEFAULT_LOCALE} lists={lists} />
    </main>
  )
}
