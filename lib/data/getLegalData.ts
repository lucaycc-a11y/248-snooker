import { getCMSList, type CMSListItem } from './getCMSList'

// Legal document numbered sections. `/legal` hosts THREE independent
// verbatim documents, each backed by its own CMS collection key:
//   - terms_sections         — 場地使用守則及條款 (facility rules)
//   - website_terms_sections — 網站使用條款 (website terms of use)
//   - privacy_sections       — 私隱政策 (privacy policy)
// One {title, body} entry per numbered clause (一、二、三...).
// Addable/removable/reorderable via CMSList so an admin can append a new
// clause, but the shipped content must never be paraphrased — see
// app/[locale]/legal/LegalContent.tsx.

export type LegalSectionFields = { title: string; body: string }

export type LegalCollectionKey =
  | 'terms_sections'
  | 'website_terms_sections'
  | 'privacy_sections'

export async function getLegalSections(
  page: 'legal',
  collectionKey: LegalCollectionKey,
  locale: string,
  fallback: { title: string; body: string }[]
): Promise<CMSListItem<LegalSectionFields>[]> {
  const items = await getCMSList<LegalSectionFields>(page, collectionKey, locale)
  if (items.length > 0) return items
  return fallback.map((s, i) => ({ id: `${collectionKey}-${i}`, orderIndex: i, fields: s }))
}
