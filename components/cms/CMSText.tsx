'use client'

import { useCMSValue, useCMS } from '@/lib/cms/useCMS'
import { EditableText } from './EditableText'

// Self-seeding, live-updating CMS text. `children` is the fallback — always
// the current-locale next-intl string (e.g. {t('tagline')}), never hardcoded
// English — so a visitor with no DB override still sees the correct locale's
// text. Renders data-cms-key (via EditableText) so Phase B's inline editor
// and the pre-existing manually-placed data-cms-key attributes converge on
// one DOM contract. EditableText itself no-ops to plain rendering when
// edit-mode isn't active (i.e. for every non-admin visitor).

export type CMSTextProps = {
  k: string
  children: string
  as?: keyof JSX.IntrinsicElements
  className?: string
  style?: React.CSSProperties
}

export function CMSText({ k, children, as: Tag = 'span', className, style }: CMSTextProps) {
  const value = useCMSValue(k, children)
  const { locale } = useCMS()
  return <EditableText cmsKey={k} locale={locale} value={value} as={Tag} className={className} style={style} />
}
