import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { IconButton } from './Button'
import Logo from './Logo'
import NavItem from './NavItem'

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
    href === '/admin' ? activeHref === '/admin' : activeHref.startsWith(href)

  return (
    <aside className={`admin-ui-sidebar ${collapsed ? 'admin-ui-sidebar--collapsed' : ''}`}>
      <div className="admin-ui-sidebar__header">
        <Logo compact={collapsed} />
        {onToggleCollapse && (
          <IconButton label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={onToggleCollapse}>
            {collapsed ? (
              <PanelLeftOpen size={20} strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <PanelLeftClose size={20} strokeWidth={1.5} aria-hidden="true" />
            )}
          </IconButton>
        )}
      </div>

      <nav className="admin-ui-sidebar__nav" aria-label="Admin navigation">
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

      {adminInitial && (
        <div className="admin-ui-sidebar__identity" title={collapsed ? adminName : undefined}>
          <span className="admin-ui-avatar" aria-hidden="true">{adminInitial}</span>
          {!collapsed && adminName && (
            <span className="admin-ui-sidebar__identity-copy">
              <span className="admin-ui-sidebar__identity-name" data-cms-key="sidebar_admin_name">{adminName}</span>
              {adminRole && (
                <span className="admin-ui-sidebar__identity-role" data-cms-key="sidebar_admin_role">{adminRole}</span>
              )}
            </span>
          )}
        </div>
      )}
    </aside>
  )
}
