import type { ReactNode } from 'react'

type WidgetCardProps = {
  title: string
  titleCmsKey?: string
  value?: string
  action?: ReactNode
  children?: ReactNode
  className?: string
}

export default function WidgetCard({ title, titleCmsKey, value, action, children, className = '' }: WidgetCardProps) {
  return (
    <section className={`admin-ui-widget-card ${className}`}>
      <header className="admin-ui-widget-card__header">
        <h2 className="admin-ui-widget-card__title" data-cms-key={titleCmsKey}>{title}</h2>
        {action}
      </header>
      {value && <strong className="admin-ui-widget-card__value">{value}</strong>}
      {children}
    </section>
  )
}
