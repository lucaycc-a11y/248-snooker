import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

type NavItemProps = {
  href: string
  label: string
  cmsKey: string
  icon: LucideIcon
  active?: boolean
  collapsed?: boolean
  vertical?: boolean
}

export default function NavItem({
  href,
  label,
  cmsKey,
  icon: Icon,
  active = false,
  collapsed = false,
  vertical = false,
}: NavItemProps) {
  const layoutClass = vertical
    ? 'admin-ui-nav-item--vertical'
    : collapsed
      ? 'admin-ui-nav-item--collapsed'
      : ''

  return (
    <Link
      href={href}
      data-cms-key={cmsKey}
      title={collapsed ? label : undefined}
      aria-current={active ? 'page' : undefined}
      className={`admin-ui-nav-item ${active ? 'admin-ui-nav-item--active' : ''} ${layoutClass}`}
    >
      <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
      {vertical ? <span>{label}</span> : !collapsed && <span>{label}</span>}
    </Link>
  )
}
