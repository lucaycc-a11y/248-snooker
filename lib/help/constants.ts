/**
 * Help Center path constants
 *
 * Use HELP_BASE for all Help Center URL construction to ensure consistency.
 */

export const HELP_BASE = '/help-center' as const

export const HELP_PATHS = {
  home: HELP_BASE,
  topic: (topicSlug: string) => `${HELP_BASE}/${topicSlug}`,
  article: (topicSlug: string, articleSlug: string) => `${HELP_BASE}/${topicSlug}/${articleSlug}`,
  announcement: (slug: string) => `${HELP_BASE}/announcements/${slug}`,
  search: (query?: string) => query ? `${HELP_BASE}/search?q=${encodeURIComponent(query)}` : `${HELP_BASE}/search`,
} as const
