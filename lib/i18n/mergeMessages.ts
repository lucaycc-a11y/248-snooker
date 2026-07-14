import { getCMSMap } from '@/lib/data/getCMS'

/**
 * Merges static next-intl messages with live CMS overrides from the database.
 *
 * This function enables a hybrid CMS architecture where:
 * 1. Static messages/*.json files provide base translations (checked into git)
 * 2. cms_content table provides optional runtime overrides (edited by admins)
 * 3. CMSText components get the merged result seamlessly
 *
 * The merge strategy:
 * - Base: messages/{locale}.json (loaded statically at build time)
 * - Override: cms_content WHERE locale={locale} (queried at request time)
 * - Result: Base with DB values overlaid (DB wins on key conflicts)
 *
 * This ensures:
 * - Admin edits appear immediately without redeployment
 * - Missing DB keys fall back to static content (safe defaults)
 * - DB failures don't break the site (static fallback)
 */
export async function mergeMessagesWithCMS(
  staticMessages: Record<string, any>,
  locale: string
): Promise<Record<string, any>> {
  // Fetch all CMS overrides for this locale from DB
  const cmsOverrides = await getCMSMap(locale)

  // Deep clone static messages to avoid mutation
  const merged = JSON.parse(JSON.stringify(staticMessages))

  // Apply CMS overrides: convert flat keys like "pricingPage.hero_title"
  // into nested structure
  for (const [flatKey, value] of Object.entries(cmsOverrides)) {
    const parts = flatKey.split('.')
    let current = merged

    // Navigate/create nested path
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {}
      }
      current = current[part]
    }

    // Set the leaf value
    const leafKey = parts[parts.length - 1]
    current[leafKey] = value
  }

  return merged
}
