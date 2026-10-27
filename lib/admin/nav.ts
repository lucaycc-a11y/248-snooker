/**
 * Single source of truth for admin navigation.
 *
 * Every mounted admin page is reachable from here with at most two taps
 * (area menu -> page). The earlier "five areas only" rule was replaced on
 * 27 Oct 2026: Luca asked for every page to be pressable from the nav.
 *
 * Not listed on purpose: /admin/ai and /admin/slots (empty placeholder stubs),
 * /admin/login and /admin/accept-invite (outside the guarded shell), and
 * dynamic detail routes (/admin/bookings/[id], /admin/members/[id],
 * /admin/blog/[id]) which are opened from their list pages.
 */

export type AdminAreaId = 'home' | 'today' | 'bookings' | 'members' | 'money' | 'site' | 'system'

export type AdminNavItem = {
  href: string
  label: string
  cmsKey: string
  /** Hidden from the nav when the viewer is not super_admin. */
  superAdminOnly?: boolean
  /** Match the active state against this path instead of `href`. */
  match?: string
  /** One short line shown under the label in the menu. */
  hint?: string
}

export type AdminArea = {
  id: AdminAreaId
  label: string
  /** Compact label for the phone bottom bar. */
  shortLabel: string
  cmsKey: string
  icon: 'home' | 'today' | 'list' | 'users' | 'money' | 'site' | 'shield'
  href: string
  items: AdminNavItem[]
}

export const ADMIN_AREAS: AdminArea[] = [
  {
    id: 'home',
    label: '首頁',
    shortLabel: '首頁',
    cmsKey: 'admin.nav.home',
    icon: 'home',
    href: '/admin',
    items: [{ href: '/admin', label: '首頁', cmsKey: 'admin.nav.home', hint: '總覽、房間時間表與待處理事項' }],
  },
  {
    id: 'today',
    label: '今日',
    shortLabel: '今日',
    cmsKey: 'admin.nav.today',
    icon: 'today',
    href: '/admin/today',
    items: [
      { href: '/admin/today', label: '今日', cmsKey: 'admin.nav.today', hint: '今日預約與各房狀態' },
      { href: '/admin/calendar', label: '日曆', cmsKey: 'admin.nav.calendar', hint: '按日期查看預約' },
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
      { href: '/admin/bookings', label: '預約列表', cmsKey: 'admin.nav.bookings', hint: '搜尋、篩選與手動新增預約' },
      { href: '/admin/orders', label: '訂單查詢', cmsKey: 'admin.nav.orders', hint: '以訂單編號查詢' },
      { href: '/admin/maintenance', label: '封枱', cmsKey: 'admin.nav.maintenance', hint: '暫停個別房間或時段' },
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
      { href: '/admin/members', label: '會員列表', cmsKey: 'admin.nav.members', hint: '搜尋與管理會員' },
      {
        href: '/admin/members?tab=flags',
        match: '/admin/members',
        label: '帳戶異常',
        cmsKey: 'admin.nav.member_flags',
        hint: '共用裝置與可疑帳戶',
      },
      { href: '/admin/follow-ups', label: '跟進名單', cmsKey: 'admin.nav.follow_ups', hint: '需要聯絡的會員' },
      { href: '/admin/notifications', label: '通知範本', cmsKey: 'admin.nav.notifications', hint: '訊息與電郵範本' },
    ],
  },
  {
    id: 'money',
    label: '收入與付款',
    shortLabel: '收入',
    cmsKey: 'admin.nav.money',
    icon: 'money',
    href: '/admin/revenue',
    items: [
      { href: '/admin/revenue', label: '收入', cmsKey: 'admin.nav.revenue', hint: '收入總覽與 Excel 匯出' },
      { href: '/admin/payment-log', label: '付款監控', cmsKey: 'admin.nav.payment_log', hint: '即時付款狀態與對賬' },
      { href: '/admin/sales-report', label: '銷售報表', cmsKey: 'admin.nav.sales_report', hint: '按期間的銷售明細' },
    ],
  },
  {
    id: 'site',
    label: '網站資料',
    shortLabel: '網站',
    cmsKey: 'admin.nav.site',
    icon: 'site',
    href: '/admin/settings',
    items: [
      { href: '/admin/settings', label: '價格與規則', cmsKey: 'admin.nav.settings', hint: '價格、時段與場地規則' },
      { href: '/admin/promos', label: '優惠碼', cmsKey: 'admin.nav.promos', hint: '建立與管理優惠碼' },
      { href: '/admin/blog', label: '網誌', cmsKey: 'admin.nav.blog', hint: '文章管理' },
      { href: '/admin/media', label: '媒體', cmsKey: 'admin.nav.media', hint: '圖片與檔案' },
      { href: '/admin/ai-settings', label: 'AI 設定', cmsKey: 'admin.nav.ai_settings', hint: '客服 AI 回覆設定' },
      { href: '/admin/site-gate', label: '全站維修', cmsKey: 'admin.nav.site_gate', superAdminOnly: true, hint: '切換維修模式與開放' },
    ],
  },
  {
    id: 'system',
    label: '系統',
    shortLabel: '系統',
    cmsKey: 'admin.nav.system',
    icon: 'shield',
    href: '/admin/audit',
    items: [
      { href: '/admin/team', label: '管理員', cmsKey: 'admin.nav.team', superAdminOnly: true, hint: '邀請與角色' },
      { href: '/admin/hidden-users', label: '隱藏帳戶', cmsKey: 'admin.nav.hidden_users', superAdminOnly: true, hint: '不計入統計的帳戶' },
      { href: '/admin/audit', label: '審計記錄', cmsKey: 'admin.nav.audit', hint: '後台操作記錄' },
      { href: '/admin/errors', label: '錯誤記錄', cmsKey: 'admin.nav.errors', hint: '系統錯誤與排查' },
      { href: '/admin/door', label: '門禁卡', cmsKey: 'admin.nav.door', hint: '門禁卡管理' },
      { href: '/admin/door-lock', label: '門鎖', cmsKey: 'admin.nav.door_lock', hint: '門鎖狀態與控制' },
      { href: '/admin/lockers', label: '儲物櫃', cmsKey: 'admin.nav.lockers', hint: '儲物櫃管理' },
      { href: '/admin/qr-generator', label: 'QR 產生器', cmsKey: 'admin.nav.qr_generator', hint: '產生門禁或活動 QR' },
      { href: '/admin/uat-access', label: 'UAT 存取', cmsKey: 'admin.nav.uat_access', superAdminOnly: true, hint: '測試環境存取名單' },
      { href: '/admin/dev2', label: '測試面板', cmsKey: 'admin.nav.dev2', superAdminOnly: true, hint: '付款與預約測試工具' },
      { href: '/admin/style-guide', label: '風格指南', cmsKey: 'admin.nav.style_guide', hint: '後台介面元件' },
    ],
  },
]

/** Pages that are mounted but intentionally not in the nav (see header note). */
export const ADMIN_UNLISTED_STUBS = ['/admin/ai', '/admin/slots'] as const

/** Flat list of every nav leaf, for the global search and route audits. */
export function allNavItems(): (AdminNavItem & { areaId: AdminAreaId; areaLabel: string })[] {
  return ADMIN_AREAS.flatMap((area) =>
    area.items.map((item) => ({ ...item, areaId: area.id, areaLabel: area.label })),
  )
}

function basePath(item: AdminNavItem): string {
  return (item.match ?? item.href).split('?')[0]
}

function pathMatches(path: string, base: string): boolean {
  if (base === '/admin') return path === '/admin'
  return path === base || path.startsWith(`${base}/`)
}

/** Area a pathname belongs to, used for the active state. */
export function areaForPath(pathname: string): AdminAreaId {
  const path = pathname.replace(/\/$/, '') || '/admin'
  let best: { id: AdminAreaId; len: number } | null = null
  for (const area of ADMIN_AREAS) {
    for (const item of area.items) {
      const base = basePath(item)
      if (pathMatches(path, base) && (!best || base.length > best.len)) {
        best = { id: area.id, len: base.length }
      }
    }
  }
  return best?.id ?? 'home'
}

/** The nav leaf a pathname resolves to (longest matching base wins). */
export function itemForPath(pathname: string): AdminNavItem | null {
  const path = pathname.replace(/\/$/, '') || '/admin'
  let best: AdminNavItem | null = null
  for (const area of ADMIN_AREAS) {
    for (const item of area.items) {
      const base = basePath(item)
      if (pathMatches(path, base) && (!best || base.length > basePath(best).length)) {
        best = item
      }
    }
  }
  return best
}

export function visibleItems(items: AdminNavItem[], isSuperAdmin: boolean): AdminNavItem[] {
  return items.filter((item) => isSuperAdmin || !item.superAdminOnly)
}

/** Areas with at least one page the viewer may open. */
export function visibleAreas(isSuperAdmin: boolean): AdminArea[] {
  return ADMIN_AREAS.filter((area) => visibleItems(area.items, isSuperAdmin).length > 0)
}
