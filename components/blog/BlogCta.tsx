import type { ReactNode } from 'react'

// In-article call-to-action card. Plain markup (no hooks, no i18n provider) so
// it renders identically in the public article and in the admin preview.

export type CtaText = {
  booking_title: string; booking_text: string; booking_label: string
  member_title: string; member_text: string; member_label: string
}

function localePrefix(locale: string): string {
  return locale === 'zh-HK' ? '' : `/${locale}`
}

// Custom links must be https or a site-relative path; anything else is dropped.
function safeHref(value: string | undefined): string | null {
  const v = (value ?? '').trim()
  if (/^https:\/\//i.test(v)) return v
  if (/^\/(?!\/)/.test(v)) return v
  return null
}

export function renderBlogCta(
  kind: string,
  attrs: Record<string, string>,
  key: number,
  text: CtaText,
  locale: string,
): ReactNode {
  const prefix = localePrefix(locale)
  let title = attrs['data-title'] ?? ''
  let body = attrs['data-text'] ?? ''
  let label = attrs['data-label'] ?? ''
  let href: string | null
  if (kind === 'cta-booking') {
    title ||= text.booking_title; body ||= text.booking_text; label ||= text.booking_label
    href = `${prefix}/book`
  } else if (kind === 'cta-member') {
    title ||= text.member_title; body ||= text.member_text; label ||= text.member_label
    href = `${prefix}/member`
  } else {
    href = safeHref(attrs['data-href'])
  }
  if (!href || !label) return null
  const external = /^https:\/\//i.test(href)
  return (
    <aside key={key} className="s8-cta">
      {title ? <p className="s8-cta-title">{title}</p> : null}
      {body ? <p className="s8-cta-text">{body}</p> : null}
      <a className="s8-cta-btn" href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{label}</a>
    </aside>
  )
}
