/**
 * Single source of truth for admin navigation.
 *
 * Five top-level areas mirror the admin prototype (`space8-admin.html`).
 * Leaf routes stay deep-linkable. The shell renders ONLY these five areas —
 * no "更多" drawer (Luca: keep it simple). Overflow routes stay mounted and
 * reachable by URL; they are just not offered in navigation.
 */

export type AdminAreaId = 'today' | 'bookings' | 'members' | 'site' | 'system'

export type AdminNavItem = {
  href: string
  label: string
  cmsKey: string
  /** Hidden from the rail when the viewer is not super_admin. */
  superAdminOnly?: boolean
  /** Match the active state against this path instead of `href`. */
  match?: string
}

export type AdminArea = {
  id: AdminAreaId
  label: string
  /**
   * Compact label for the phone bottom bar. The prototype's NAV carries a
   * separate short string per row (`網站資料` / `網站`) because the pill bar
   * is only five columns wide.
   */
  shortLabel: string
  cmsKey: string
  /** Icon key understood by the shell. */
  icon: 'today' | 'list' | 'users' | 'site' | 'shield'
  href: string
  items: AdminNavItem[]
}

export const ADMIN_AREAS: AdminArea[] = [
  {
    id: 'today',
    label: '今日',
    shortLabel: '今日',
    cmsKey: 'admin.nav.today',
    icon: 'today',
    href: '/admin',
    items: [
      { href: '/admin', label: '今日', cmsKey: 'admin.nav.today' },
    ],
  },
  {
    id: 'bookings',
    label: '預約',
    shortLabel: '預約',
    cmsKey: 'admin.nav.bookings',
    icon: 'list',
    href: '/admin/bookings',
    items: [
      { href: '/admin/bookings', label: '預約', cmsKey: 'admin.nav.bookings' },
      { href: '/admin/payment-log', label: '付款記錄', cmsKey: 'admin.nav.payment_log' },
      { href: '/admin/calendar', label: '日曆', cmsKey: 'admin.nav.calendar' },
      { href: '/admin/revenue', label: '收入', cmsKey: 'admin.nav.revenue' },
    ],
  },
  {
    id: 'members',
    label: '會員',
    shortLabel: '會員',
    cmsKey: 'admin.nav.members',
    icon: 'users',
    href: '/admin/members',
    items: [
      { href: '/admin/members', label: '會員列表', cmsKey: 'admin.nav.members' },
      {
        href: '/admin/members?tab=flags',
        match: '/admin/members',
        label: '帳戶異常',
        cmsKey: 'admin.nav.member_flags',
      },
      { href: '/admin/follow-ups', label: '跟進名單', cmsKey: 'admin.nav.follow_ups' },
    ],
  },
  {
    id: 'site',
    label: '網站資料',
    shortLabel: '網站',
    cmsKey: 'admin.nav.site',
    icon: 'site',
    href: '/admin/site-gate',
    items: [
      { href: '/admin/site-gate', label: '全站維修', cmsKey: 'admin.nav.site_gate', superAdminOnly: true },
      { href: '/admin/maintenance', label: '封枱', cmsKey: 'admin.nav.maintenance' },
      { href: '/admin/settings', label: '價格與規則', cmsKey: 'admin.nav.settings' },
      { href: '/admin/promos', label: '優惠碼', cmsKey: 'admin.nav.promos' },
    ],
  },
  {
    id: 'system',
    label: '系統',
    shortLabel: '系統',
    cmsKey: 'admin.nav.system',
    icon: 'shield',
    href: '/admin/team',
    items: [
      { href: '/admin/team', label: '管理員', cmsKey: 'admin.nav.team', superAdminOnly: true },
      { href: '/admin/hidden-users', label: '隱藏帳戶', cmsKey: 'admin.nav.hidden_users', superAdminOnly: true },
      { href: '/admin/audit', label: '審計記錄', cmsKey: 'admin.nav.audit' },
      { href: '/admin/errors', label: '錯誤記錄', cmsKey: 'admin.nav.errors' },
    ],
  },
]

/**
 * Routes that stay mounted but are not one of the five primary tabs.
 * Not rendered anywhere in navigation — deep-linkable only. Nothing here is
 * deleted or redirected away (Luca's scope boundary).
 */
export const ADMIN_OVERFLOW: AdminNavItem[] = [
  { href: '/admin/orders', label: '訂單查詢', cmsKey: 'admin.nav.orders' },
  { href: '/admin/blog', label: '網誌', cmsKey: 'admin.nav.blog' },
  { href: '/admin/notifications', label: '通知', cmsKey: 'admin.nav.notifications' },
  // /admin/sales-report stays mounted as a deep link (Luca: never delete a
  // route) but is no longer listed anywhere — /admin/revenue is the one money
  // entry and reads the same loader the Excel export uses.
  { href: '/admin/door', label: '門禁卡', cmsKey: 'admin.nav.door' },
  { href: '/admin/door-lock', label: '門鎖', cmsKey: 'admin.nav.door_lock' },
  { href: '/admin/lockers', label: '儲物櫃', cmsKey: 'admin.nav.lockers' },
  { href: '/admin/qr-generator', label: 'QR 產生器', cmsKey: 'admin.nav.qr_generator' },
  { href: '/admin/ai-settings', label: 'AI 設定', cmsKey: 'admin.nav.ai_settings' },
  { href: '/admin/media', label: '媒體', cmsKey: 'admin.nav.media' },
  { href: '/admin/slots', label: '時段', cmsKey: 'admin.nav.slots' },
  { href: '/admin/uat-access', label: 'UAT 存取', cmsKey: 'admin.nav.uat_access', superAdminOnly: true },
  { href: '/admin/style-guide', label: '風格指南', cmsKey: 'admin.nav.style_guide' },
]

/** Area a pathname belongs to, used for rail/tabs active state. */
export function areaForPath(pathname: string): AdminAreaId {
  const path = pathname.replace(/\/$/, '') || '/admin'
  if (path === '/admin') return 'today'
  if (
    path.startsWith('/admin/bookings') ||
    path.startsWith('/admin/payment-log') ||
    path.startsWith('/admin/calendar') ||
    path.startsWith('/admin/revenue')
  ) {
    return 'bookings'
  }
  if (path.startsWith('/admin/members') || path.startsWith('/admin/follow-ups')) return 'members'
  if (
    path.startsWith('/admin/site-gate') ||
    path.startsWith('/admin/maintenance') ||
    path.startsWith('/admin/settings') ||
    path.startsWith('/admin/promos')
  ) {
    return 'site'
  }
  return 'system'
}

export function visibleItems(items: AdminNavItem[], isSuperAdmin: boolean): AdminNavItem[] {
  return items.filter((item) => isSuperAdmin || !item.superAdminOnly)
}
