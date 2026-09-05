'use client'

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
  return (
    <Link
      href={href}
      data-cms-key={cmsKey}
      title={collapsed ? label : undefined}
      className={`
        flex items-center no-underline text-sm font-medium
        whitespace-nowrap
        ${vertical ? 'flex-col gap-0.5 w-16 justify-center' : `gap-2 ${collapsed ? 'justify-center px-0 py-[10px]' : 'justify-start px-2 py-[10px]'}`}
        rounded-[var(--radius-button)]
        ${
          active
            ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-semibold border-l-[3px] border-l-[var(--green-bright)]'
            : 'bg-transparent text-[var(--text-secondary)] border-l-[3px] border-l-transparent'
        }
      `}
    >
      <Icon size={20} strokeWidth={1.5} className="shrink-0" />
      {vertical ? (
        <span className="text-[10px] font-medium leading-tight">{label}</span>
      ) : (
        !collapsed && label
      )}
    </Link>
  )
}
