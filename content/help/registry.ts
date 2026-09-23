import type { HelpArticleSlug, HelpCategory } from './types'

export interface HelpArticleMetadata {
  slug: HelpArticleSlug
  category: HelpCategory
  icon: string // Lucide icon name
  titleKey: string // i18n key for article title
  excerptKey: string // i18n key for article excerpt
  order: number // Display order within category
}

export const helpArticles: HelpArticleMetadata[] = [
  {
    slug: 'entry-qr',
    category: 'getting-started',
    icon: 'QrCode',
    titleKey: 'help.articles.entry-qr.title',
    excerptKey: 'help.articles.entry-qr.excerpt',
    order: 1,
  },
  {
    slug: 'booking',
    category: 'booking',
    icon: 'Calendar',
    titleKey: 'help.articles.booking.title',
    excerptKey: 'help.articles.booking.excerpt',
    order: 1,
  },
  {
    slug: 'account-login',
    category: 'account',
    icon: 'LogIn',
    titleKey: 'help.articles.account-login.title',
    excerptKey: 'help.articles.account-login.excerpt',
    order: 1,
  },
  {
    slug: 'find-qr',
    category: 'support',
    icon: 'Search',
    titleKey: 'help.articles.find-qr.title',
    excerptKey: 'help.articles.find-qr.excerpt',
    order: 1,
  },
  {
    slug: 'tier-points',
    category: 'account',
    icon: 'Award',
    titleKey: 'help.articles.tier-points.title',
    excerptKey: 'help.articles.tier-points.excerpt',
    order: 2,
  },
  {
    slug: 'cancellation-policy',
    category: 'policies',
    icon: 'XCircle',
    titleKey: 'help.articles.cancellation-policy.title',
    excerptKey: 'help.articles.cancellation-policy.excerpt',
    order: 1,
  },
  {
    slug: 'special-weather',
    category: 'policies',
    icon: 'Cloud',
    titleKey: 'help.articles.special-weather.title',
    excerptKey: 'help.articles.special-weather.excerpt',
    order: 2,
  },
  {
    slug: 'contact-support',
    category: 'support',
    icon: 'MessageCircle',
    titleKey: 'help.articles.contact-support.title',
    excerptKey: 'help.articles.contact-support.excerpt',
    order: 2,
  },
]

export const categoryMetadata: Record<
  HelpCategory,
  { titleKey: string; order: number }
> = {
  'getting-started': {
    titleKey: 'help.categories.getting-started',
    order: 1,
  },
  'booking': {
    titleKey: 'help.categories.booking',
    order: 2,
  },
  'account': {
    titleKey: 'help.categories.account',
    order: 3,
  },
  'policies': {
    titleKey: 'help.categories.policies',
    order: 4,
  },
  'support': {
    titleKey: 'help.categories.support',
    order: 5,
  },
}

export function getArticlesByCategory(category: HelpCategory): HelpArticleMetadata[] {
  return helpArticles
    .filter((article) => article.category === category)
    .sort((a, b) => a.order - b.order)
}

export function getAllCategories(): HelpCategory[] {
  return Object.keys(categoryMetadata)
    .sort((a, b) => categoryMetadata[a as HelpCategory].order - categoryMetadata[b as HelpCategory].order) as HelpCategory[]
}
