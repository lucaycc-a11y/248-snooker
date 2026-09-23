// Help/Support article type definitions
// All articles use code-driven content (React components), not markdown strings

export type HelpArticleSlug =
  | 'entry-qr'
  | 'booking'
  | 'account-login'
  | 'find-qr'
  | 'tier-points'
  | 'cancellation-policy'
  | 'special-weather'
  | 'contact-support'

export type HelpCategory = 'getting-started' | 'account' | 'booking' | 'policies' | 'support'

export type HelpArticle = {
  slug: HelpArticleSlug
  category: HelpCategory
  title: string // zh-HK title
  titleEn: string
  titleCn: string
  icon: React.ReactNode
  description: string // zh-HK description
  descriptionEn: string
  descriptionCn: string
  searchKeywords: string[] // For search, all locales
}

export type ArticleContentProps = {
  locale: 'zh-HK' | 'zh-CN' | 'en' | 'ja'
}
