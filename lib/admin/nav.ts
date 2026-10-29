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

export type AdminAreaId = 'home' | 'today' | 'bookings' | 'members' | 'money' | 'spark' | 'site' | 'system'

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
  /** false = reachable from the page's tab bar (and search) but not listed in the menus. */
  menu?: boolean
}

export type AdminArea = {
  id: AdminAreaId
  label: string
  /** Compact label for the phone bottom bar. */
  shortLabel: string
  cmsKey: string
  icon: 'home' | 'today' | 'list' | 'users' | 'money' | 'spark' | 'site' | 'shield'
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
      { href: '/admin/report', label: '每日報告', cmsKey: 'admin.nav.report', hint: '收入、使用率、付款與預約明細', menu: false },
      { href: '/admin/report/monthly', label: '月報', cmsKey: 'admin.nav.report_monthly', hint: '月度收入、失敗、新會員與 Spark 建議（可存成 PDF）', menu: false },
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
      { href: '/admin/orders', label: '訂單查詢', cmsKey: 'admin.nav.orders', hint: '以訂單編號查詢', menu: false },
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
      { href: '/admin/lookup', label: '客戶查詢', cmsKey: 'admin.nav.lookup', hint: '以電話或預約碼查看客人所有預約及付款經過', menu: false },
      {
        href: '/admin/members?tab=flags',
        match: '/admin/members',
        label: '帳戶異常',
        cmsKey: 'admin.nav.member_flags',
        hint: '共用裝置與可疑帳戶',
      },
      { href: '/admin/cs', label: '客務中心', cmsKey: 'admin.nav.cs', hint: '客人問題、身份核對、付款連結與 Spark 協助' },
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
      { href: '/admin/revenue', label: '收入報表', cmsKey: 'admin.nav.revenue', hint: '收入、銷售、每日與月報' },
      { href: '/admin/revenue-check', label: '收入核對', cmsKey: 'admin.nav.revenue_check', hint: '核對收入與付款，並可向 AI 查詢', menu: false },
      { href: '/admin/payment-log', label: '付款', cmsKey: 'admin.nav.payment_log', hint: '付款監控、核對、訂單與客戶查詢' },
      { href: '/admin/sales-report', label: '銷售報表', cmsKey: 'admin.nav.sales_report', hint: '按期間的銷售明細', menu: false },
    ],
  },
  {
    id: 'spark',
    label: 'Spark',
    shortLabel: 'Spark',
    cmsKey: 'admin.nav.spark',
    icon: 'spark',
    href: '/admin/spark',
    items: [
      { href: '/admin/spark', label: 'Spark 助手', cmsKey: 'admin.nav.spark', hint: '用對話查資料、處理會員與預約' },
      { href: '/admin/spark/log', label: 'Spark 操作紀錄', cmsKey: 'admin.nav.spark_log', hint: '所有由 Spark 提出的更改與結果' },
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
      { href: '/admin/email', label: '電郵發送', cmsKey: 'admin.nav.email', hint: '編輯並發送電郵給會員' },
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
    href: '/admin/activity',
    items: [
      { href: '/admin/activity', label: '記錄', cmsKey: 'admin.nav.activity', hint: '網站記錄、錯誤、審計與問題回報' },
      { href: '/admin/bug-reports', label: '問題回報', cmsKey: 'admin.nav.bug_reports', hint: '提交的問題與處理進度', menu: false },
      { href: '/admin/team', label: '管理員', cmsKey: 'admin.nav.team', superAdminOnly: true, hint: '邀請與角色' },
      { href: '/admin/hidden-users', label: '隱藏帳戶', cmsKey: 'admin.nav.hidden_users', superAdminOnly: true, hint: '不計入統計的帳戶' },
      { href: '/admin/audit', label: '審計記錄', cmsKey: 'admin.nav.audit', hint: '後台操作記錄', menu: false },
      { href: '/admin/errors', label: '錯誤記錄', cmsKey: 'admin.nav.errors', hint: '系統錯誤與排查', menu: false },
    ],
  },
]

/** Pages that are mounted but intentionally not in the nav (see header note). */
export const ADMIN_UNLISTED_STUBS = [
  '/admin/ai',
  '/admin/slots',
  // Removed from the nav on 27 Oct 2026 at Luca's request; the pages still exist by URL.
  '/admin/door',
  '/admin/door-lock',
  '/admin/lockers',
  '/admin/qr-generator',
  '/admin/uat-access',
  '/admin/dev2',
  '/admin/style-guide',
] as const

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
  return items.filter((item) => (isSuperAdmin || !item.superAdminOnly) && item.menu !== false)
}

/**
 * Pages that are one thing seen from different angles share a tab bar.
 * Each tab is still its own route, so old links and bookmarks keep working.
 */
export type AdminTabGroup = { id: string; tabs: { href: string; label: string }[] }

export const ADMIN_TAB_GROUPS: AdminTabGroup[] = [
  {
    id: 'payments',
    tabs: [
      { href: '/admin/payment-log', label: '付款監控' },
      { href: '/admin/revenue-check', label: '收入核對' },
      { href: '/admin/orders', label: '訂單查詢' },
      { href: '/admin/lookup', label: '客戶查詢' },
    ],
  },
  {
    id: 'revenue',
    tabs: [
      { href: '/admin/revenue', label: '收入' },
      { href: '/admin/sales-report', label: '銷售報表' },
      { href: '/admin/report', label: '每日報告' },
      { href: '/admin/report/monthly', label: '月報' },
    ],
  },
  {
    id: 'logs',
    tabs: [
      { href: '/admin/activity', label: '網站記錄' },
      { href: '/admin/errors', label: '錯誤記錄' },
      { href: '/admin/audit', label: '審計記錄' },
      { href: '/admin/bug-reports', label: '問題回報' },
    ],
  },
]

/** Tab group a pathname belongs to, plus the active tab (longest matching href wins). */
export function tabGroupForPath(pathname: string): { group: AdminTabGroup; active: string } | null {
  const path = pathname.replace(/\/$/, '') || '/admin'
  for (const group of ADMIN_TAB_GROUPS) {
    let best: string | null = null
    for (const tab of group.tabs) {
      if ((path === tab.href || path.startsWith(`${tab.href}/`)) && (!best || tab.href.length > best.length)) best = tab.href
    }
    if (best) return { group, active: best }
  }
  return null
}

/** Areas with at least one page the viewer may open. */
export function visibleAreas(isSuperAdmin: boolean): AdminArea[] {
  return ADMIN_AREAS.filter((area) => visibleItems(area.items, isSuperAdmin).length > 0)
}
