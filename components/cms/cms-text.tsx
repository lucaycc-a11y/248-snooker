import type { CSSProperties, ElementType, ReactNode } from 'react'
import { getCMS } from '@/lib/data/getCMS'
import { getLocale } from 'next-intl/server'

export type CMSTextProps<T extends ElementType = 'span'> = {
  cmsKey: string
  fallback: ReactNode
  as?: T
  locale?: string
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

export default async function CMSText<T extends ElementType = 'span'>({
  cmsKey,
  fallback,
  as,
  locale,
  className,
  style,
  children,
}: CMSTextProps<T>) {
  const resolvedLocale = locale ?? (await getLocale().catch(() => 'zh-HK'))
  const value = await getCMS(cmsKey, resolvedLocale)
  const Component = (as ?? 'span') as ElementType
  const content = value && value !== cmsKey ? value : (fallback ?? children ?? '')

  return (
    <Component data-cms-key={cmsKey} className={className} style={style}>
      {content}
    </Component>
  )
}
