'use client'

import type { LucideIcon } from 'lucide-react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import Logo from './Logo'
import NavItem from './NavItem'
import { IconButton } from './Button'

type SidebarNavItem = {
  href: string
  label: string
  cmsKey: string
  icon: LucideIcon
}

type SidebarProps = {
  items: SidebarNavItem[]
  activeHref: string
  collapsed?: boolean
  onToggleCollapse?: () => void
  adminInitial?: string
  adminName?: string
  adminRole?: string
}

export default function Sidebar({
  items,
  activeHref,
  collapsed = false,
  onToggleCollapse,
  adminInitial,
  adminName,
  adminRole,
}: SidebarProps) {
  const isActive = (href: string) =>
    href === '/admin'
      ? activeHref === '/admin'
      : activeHref?.startsWith(href) ?? false

  return (
    <aside
      className={`
        hidden lg:flex flex-col shrink-0 min-h-screen
        bg-[var(--surface-primary)] border-r border-[var(--border-subtle)]
        p-4 gap-1
        ${collapsed ? 'w-[72px]' : 'w-[220px]'}
        transition-[width] duration-200 ease-[var(--ease-standard)]
        overflow-hidden
      `}
    >
      {/* Header: logo + collapse toggle */}
      <div
        className={`flex items-center mb-6 px-1 ${
          collapsed ? 'justify-center' : 'justify-between'
        }`}
      >
        {!collapsed ? (
          <Logo className="h-6 w-auto" />
        ) : (
          <Logo className="h-6 w-auto" />
        )}
        {onToggleCollapse && (
          <IconButton
            label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={onToggleCollapse}
          >
            {collapsed ? (
              <PanelLeftOpen size={20} strokeWidth={1.5} />
            ) : (
              <PanelLeftClose size={20} strokeWidth={1.5} />
            )}
          </IconButton>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex flex-col gap-0.5 flex-1">
        {items.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            cmsKey={item.cmsKey}
            icon={item.icon}
            active={isActive(item.href)}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* Admin identity */}
      {adminInitial && (
        <div
          className={`flex items-center gap-2 px-2 py-[10px] mt-2 border-t border-[var(--border-subtle)] ${
            collapsed ? 'justify-center' : 'justify-start'
          }`}
          title={collapsed ? adminName : undefined}
        >
          <div
            aria-hidden="true"
            className="flex items-center justify-center w-7 h-7 rounded-full shrink-0 bg-[var(--green-bright)] text-[var(--surface-primary)] text-xs font-bold"
          >
            {adminInitial}
          </div>
          {!collapsed && adminName && (
            <div className="min-w-0 overflow-hidden">
              <div
                className="text-[13px] font-semibold text-[var(--text-primary)] truncate"
                data-cms-key="sidebar_admin_name"
              >
                {adminName}
              </div>
              {adminRole && (
                <div
                  className="text-[11px] text-[var(--text-secondary)] capitalize"
                  data-cms-key="sidebar_admin_role"
                >
                  {adminRole}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
