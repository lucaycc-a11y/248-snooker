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

export type HelpArticleContent = {
  title: string
  intro?: string
  sections: Array<{
    title: string
    content: Array<string | { type: 'callout'; variant: 'info' | 'warning'; text: string }>
  }>
}
