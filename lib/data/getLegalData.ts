import { getCMSList, type CMSListItem } from './getCMSList'

// Legal document numbered sections (terms of service, privacy policy) are
// addable/removable/reorderable (CMSList) — an admin can add a new clause.
// Scoped to terms_sections/privacy_sections only: the refund table and rules
// bullet lists (refund_rows, refund_times, rules_allowed, rules_prohibited,
// rules_notes) stay on static next-intl t.raw() rendering — they're fixed
// reference data, not open-ended content an admin would "add another one of"
// the way FAQ items or terms clauses are. Deferred, not silently dropped.

export type LegalSectionFields = { title: string; body: string }

export async function getLegalSections(
  page: 'legal',
  collectionKey: 'terms_sections' | 'privacy_sections',
  locale: string,
  fallback: { title: string; body: string }[]
): Promise<CMSListItem<LegalSectionFields>[]> {
  const items = await getCMSList<LegalSectionFields>(page, collectionKey, locale)
  if (items.length > 0) return items
  return fallback.map((s, i) => ({ id: `${collectionKey}-${i}`, orderIndex: i, fields: s }))
}
