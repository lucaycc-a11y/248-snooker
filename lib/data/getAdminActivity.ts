import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { str, type Row } from '@/lib/data/adminReadHelpers'

// Server-only loader for 網站記錄 (/admin/activity): one timeline over the
// tables the site already writes, plus health checks that answer "is
// anything broken right now?". Read-only.

export type ActivityKind = 'booking' | 'payment' | 'webhook' | 'error' | 'admin' | 'notify' | 'gate'
export type ActivityTone = 'good' | 'warn' | 'bad' | 'info' | 'mute'

export type ActivityItem = {
  id: string
  at: string
  kind: ActivityKind
  tone: ActivityTone
  title: string
  detail: string | null
  href: string | null
}

export type HealthCheck = {
  key: string
  label: string
  value: string
  tone: ActivityTone
  hint: string
  href: string | null
}

export type ActivityFilter = 'all' | ActivityKind
export type AdminActivityData = {
  filter: ActivityFilter
  hours: number
  problemsOnly: boolean
  items: ActivityItem[]
  counts: Record<ActivityKind, number>
  health: HealthCheck[]
  error: string | null
}

const PAYMENT_EVENT: Record<string, string> = {
  confirmed: '預約已確認',
  webhook_paid_confirmed: 'KPay 通知已付款，預約確認',
  webhook_closed_or_failed: 'KPay 通知訂單關閉或失敗',
  reconcile_order_closed: '對賬：KPay 訂單已關閉',
  swept_expired: '逾時未付款，自動釋放',
  cancel_refused: '取消要求被拒絕',
  incident_parked: '已標記待人手處理',
}

const ADMIN_ACTION: Record<string, string> = {
  manual_booking_created: '手動新增預約',
  booking_admin_cancel: '管理員取消預約',
  booking_cancel_with_credit: '取消預約並退回錢包額度',
  booking_mark_test: '標記為測試預約',
  booking_weather_reschedule: '天氣改期',
  member_credit_adjust: '調整會員錢包額度',
  member_adjust_points: '調整會員積分',
  member_points_adjust: '調整會員積分',
  member_message: '發送會員訊息',
  promo_code_created: '新增優惠碼',
  promo_code_updated: '修改優惠碼',
  promo_code_enabled: '啟用優惠碼',
  promo_create: '新增推廣',
  promo_update: '修改推廣',
  config_update: '修改價格或規則',
  site_gate_toggle: '切換全站維修',
  site_gate_set_password: '設定網站閘門密碼',
  site_gate_regenerate_password: '重設網站閘門密碼',
  site_gate_whitelist_add: '新增 IP 白名單',
  site_gate_whitelist_remove: '移除 IP 白名單',
  admin_invite: '邀請管理員',
  admin_invite_accepted: '管理員接受邀請',
  admin_role_change: '更改管理員角色',
  admin_revoke: '移除管理員',
  admin_granted: '授予管理員',
  hidden_user_add: '新增隱藏帳戶',
  hidden_user_remove: '移除隱藏帳戶',
  revenue_export: '匯出收入 Excel',
  payment_reconcile: '手動對賬',
  payment_dev_kpay: '測試面板 KPay 付款',
  payment_dev_kpay_denied: '測試面板 KPay 被拒',
  blog_post_create: '新增文章',
  blog_post_update: '修改文章',
  blog_post_publish: '發佈文章',
  blog_post_unpublish: '取消發佈文章',
  cms_publish: '發佈網站文字',
  points_reset_all: '重設所有積分',
}

const ALL_KINDS: ActivityKind[] = ['booking', 'payment', 'webhook', 'error', 'admin', 'notify', 'gate']

function hkClock(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

function ago(iso: string | null): string {
  if (!iso) return '從未'
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms)) return '—'
  const min = Math.floor(ms / 60000)
  if (min < 60) return `${Math.max(1, min)} 分鐘前`
  const hr = Math.floor(min / 60)
  if (hr < 48) return `${hr} 小時前`
  return `${Math.floor(hr / 24)} 日前`
}

export async function getAdminActivity(input: {
  filter?: string
  hours?: number
  problemsOnly?: boolean
}): Promise<AdminActivityData> {
  const filter: ActivityFilter = ALL_KINDS.includes(input.filter as ActivityKind) ? (input.filter as ActivityKind) : 'all'
  const hours = [24, 72, 168].includes(input.hours ?? 0) ? (input.hours as number) : 24
  const problemsOnly = input.problemsOnly === true
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString()
  const service = getLegacyServiceSupabase()
  const failures: string[] = []
  const items: ActivityItem[] = []

  const want = (k: ActivityKind) => filter === 'all' ? k !== 'gate' : filter === k

  const tasks: Promise<void>[] = []

  if (want('booking')) {
    tasks.push((async () => {
      const { data, error } = await service
        .from('bookings')
        .select('id, human_code, date, start_time, table_number, total_price, status, is_test, created_at, payment_method')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw new Error(`預約：${error.message}`)
      for (const r of (data ?? []) as unknown as Row[]) {
        const status = str(r, ['status']) ?? ''
        items.push({
          id: `b-${String(r.id)}`,
          at: str(r, ['created_at']) ?? '',
          kind: 'booking',
          tone: status === 'confirmed' ? 'good' : status === 'payment_failed' || status === 'payment_review' ? 'bad' : status === 'pending' ? 'warn' : 'mute',
          title: `新預約 ${str(r, ['human_code']) ?? ''}${r.is_test === true ? '（測試）' : ''}`,
          detail: `${str(r, ['date']) ?? ''} ${(str(r, ['start_time']) ?? '').slice(0, 5)} · 房 ${String(r.table_number ?? '—')} · HK$${String(r.total_price ?? 0)} · ${status}${str(r, ['payment_method']) ? ` · ${str(r, ['payment_method'])}` : ''}`,
          href: `/admin/lookup?booking=${String(r.id)}`,
        })
      }
    })())
  }

  if (want('payment')) {
    tasks.push((async () => {
      const [events, attempts] = await Promise.all([
        service.from('payment_events').select('id, created_at, booking_id, human_code, event, source, reason').gte('created_at', since).order('created_at', { ascending: false }).limit(200),
        service.from('payment_attempts').select('id, created_at, booking_id, provider, provider_order_no, status, failure_code, failure_reason').gte('created_at', since).order('created_at', { ascending: false }).limit(200),
      ])
      if (events.error) throw new Error(`付款事件：${events.error.message}`)
      if (attempts.error) throw new Error(`付款嘗試：${attempts.error.message}`)
      for (const r of (events.data ?? []) as unknown as Row[]) {
        const ev = str(r, ['event']) ?? ''
        items.push({
          id: `pe-${String(r.id)}`,
          at: str(r, ['created_at']) ?? '',
          kind: 'payment',
          tone: ev.includes('confirmed') ? 'good' : ev.includes('fail') || ev.includes('refused') || ev.includes('incident') ? 'bad' : 'info',
          title: `${PAYMENT_EVENT[ev] ?? ev}${str(r, ['human_code']) ? ` · ${str(r, ['human_code'])}` : ''}`,
          detail: [str(r, ['source']) ? `來源 ${str(r, ['source'])}` : null, str(r, ['reason'])].filter(Boolean).join(' · ') || null,
          href: typeof r.booking_id === 'string' ? `/admin/lookup?booking=${r.booking_id}` : null,
        })
      }
      for (const r of (attempts.data ?? []) as unknown as Row[]) {
        const s = str(r, ['status']) ?? ''
        items.push({
          id: `pa-${String(r.id)}`,
          at: str(r, ['created_at']) ?? '',
          kind: 'payment',
          tone: s === 'succeeded' ? 'good' : s === 'failed' ? 'bad' : s === 'expired' || s === 'cancelled' ? 'mute' : 'warn',
          title: `付款嘗試（${str(r, ['provider']) ?? '—'}）：${s === 'succeeded' ? '成功' : s === 'failed' ? '失敗' : s === 'expired' ? '逾時' : s === 'cancelled' ? '已取消' : '進行中'}`,
          detail: [str(r, ['provider_order_no']), str(r, ['failure_code']), str(r, ['failure_reason'])].filter(Boolean).join(' · ') || null,
          href: typeof r.booking_id === 'string' ? `/admin/lookup?booking=${r.booking_id}` : null,
        })
      }
    })())
  }

  if (want('webhook')) {
    tasks.push((async () => {
      const { data, error } = await service
        .from('webhook_events')
        .select('id, type, received_at, status, error, provider')
        .gte('received_at', since)
        .order('received_at', { ascending: false })
        .limit(200)
      if (error) throw new Error(`Webhook：${error.message}`)
      for (const r of (data ?? []) as unknown as Row[]) {
        const s = str(r, ['status']) ?? ''
        items.push({
          id: `wh-${String(r.id)}`,
          at: str(r, ['received_at']) ?? '',
          kind: 'webhook',
          tone: s === 'processed' ? 'good' : s === 'failed' ? 'bad' : 'info',
          title: `${(str(r, ['provider']) ?? 'webhook').toUpperCase()} 通知：${str(r, ['type']) ?? ''}（${s === 'processed' ? '已處理' : s === 'failed' ? '處理失敗' : s}）`,
          detail: str(r, ['error']),
          href: null,
        })
      }
    })())
  }

  if (want('error')) {
    tasks.push((async () => {
      let q = service
        .from('site_error_log')
        .select('id, source, severity, message, created_at, resolved')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(300)
      // `info` rows are page-load telemetry (e.g. member-page-success) — noise here.
      q = q.neq('severity', 'info')
      const { data, error } = await q
      if (error) throw new Error(`錯誤記錄：${error.message}`)
      for (const r of (data ?? []) as unknown as Row[]) {
        const sev = str(r, ['severity']) ?? ''
        items.push({
          id: `er-${String(r.id)}`,
          at: str(r, ['created_at']) ?? '',
          kind: 'error',
          tone: r.resolved === true ? 'mute' : sev === 'error' ? 'bad' : 'warn',
          title: `${str(r, ['source']) ?? '未知來源'}：${str(r, ['message']) ?? ''}`,
          detail: r.resolved === true ? '已標記解決' : sev === 'error' ? '錯誤' : '警告',
          href: '/admin/errors',
        })
      }
    })())
  }

  if (want('admin')) {
    tasks.push((async () => {
      const { data, error } = await service
        .from('audit_log')
        .select('id, action, target_table, target_id, admin_email, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw new Error(`操作記錄：${error.message}`)
      for (const r of (data ?? []) as unknown as Row[]) {
        const action = str(r, ['action']) ?? ''
        items.push({
          id: `au-${String(r.id)}`,
          at: str(r, ['created_at']) ?? '',
          kind: 'admin',
          tone: action.includes('cancel') || action.includes('revoke') || action.includes('reset') ? 'warn' : 'info',
          title: ADMIN_ACTION[action] ?? action,
          detail: [str(r, ['admin_email']), str(r, ['target_table']), str(r, ['target_id'])?.slice(0, 8)].filter(Boolean).join(' · ') || null,
          href: '/admin/audit',
        })
      }
    })())
  }

  if (want('notify')) {
    tasks.push((async () => {
      const { data, error } = await service
        .from('notification_log')
        .select('id, booking_id, channel, type, status, sent_at, error_message')
        .gte('sent_at', since)
        .order('sent_at', { ascending: false })
        .limit(200)
      if (error) throw new Error(`通知記錄：${error.message}`)
      for (const r of (data ?? []) as unknown as Row[]) {
        const s = str(r, ['status']) ?? ''
        items.push({
          id: `nt-${String(r.id)}`,
          at: str(r, ['sent_at']) ?? '',
          kind: 'notify',
          tone: s === 'sent' ? 'good' : s === 'failed' ? 'bad' : 'warn',
          title: `${str(r, ['channel']) === 'whatsapp' ? 'WhatsApp' : str(r, ['channel']) === 'email' ? '電郵' : str(r, ['channel']) ?? ''}：${str(r, ['type']) ?? ''}（${s === 'sent' ? '已發送' : s === 'pending' ? '未發送' : s}）`,
          detail: str(r, ['error_message']),
          href: typeof r.booking_id === 'string' ? `/admin/lookup?booking=${r.booking_id}` : null,
        })
      }
    })())
  }

  if (want('gate')) {
    tasks.push((async () => {
      const { data, error } = await service
        .from('site_gate_access_log')
        .select('id, ip_address, method, user_agent, attempted_at')
        .gte('attempted_at', since)
        .order('attempted_at', { ascending: false })
        .limit(200)
      if (error) throw new Error(`網站閘門：${error.message}`)
      for (const r of (data ?? []) as unknown as Row[]) {
        items.push({
          id: `gt-${String(r.id)}`,
          at: str(r, ['attempted_at']) ?? '',
          kind: 'gate',
          tone: 'info',
          title: `網站閘門存取 ${str(r, ['ip_address']) ?? ''}（${str(r, ['method']) ?? ''}）`,
          detail: (str(r, ['user_agent']) ?? '').slice(0, 120) || null,
          href: '/admin/uat-access',
        })
      }
    })())
  }

  const settled = await Promise.allSettled(tasks)
  for (const s of settled) {
    if (s.status === 'rejected') {
      failures.push(s.reason instanceof Error ? s.reason.message : '部分記錄載入失敗')
      console.error('[admin/activity] load failed', s.reason)
    }
  }

  const counts = Object.fromEntries(ALL_KINDS.map((k) => [k, 0])) as Record<ActivityKind, number>
  for (const it of items) counts[it.kind] += 1

  let shown = items.filter((it) => it.at)
  if (problemsOnly) shown = shown.filter((it) => it.tone === 'bad' || it.tone === 'warn')
  shown.sort((a, b) => b.at.localeCompare(a.at))

  // ── Health checks (always last 24 h / now, independent of the filter) ────
  const health: HealthCheck[] = []
  try {
    const day = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const stuckBefore = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const [lastPaid, lastHook, failedHooks, errors, waPending, stuck, review] = await Promise.all([
      service.from('payment_attempts').select('completed_at, created_at').eq('status', 'succeeded').order('created_at', { ascending: false }).limit(1),
      service.from('webhook_events').select('received_at').order('received_at', { ascending: false }).limit(1),
      service.from('webhook_events').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('received_at', day),
      service.from('site_error_log').select('source').eq('severity', 'error').eq('resolved', false).gte('created_at', day).limit(1000),
      service.from('notification_log').select('id', { count: 'exact', head: true }).eq('channel', 'whatsapp').eq('status', 'pending'),
      service.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending').eq('is_test', false).lt('created_at', stuckBefore),
      service.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'payment_review').eq('is_test', false),
    ])
    const healthError = [lastPaid, lastHook, failedHooks, errors, waPending, stuck, review].find((r) => r.error)?.error
    if (healthError) throw healthError
    const paidAt = ((lastPaid.data ?? []) as unknown as Row[])[0]
    const paidIso = paidAt ? str(paidAt, ['completed_at', 'created_at']) : null
    health.push({ key: 'paid', label: '最近一次成功付款', value: ago(paidIso), tone: 'info', hint: paidIso ? hkClock(paidIso) : '沒有記錄', href: '/admin/payment-log' })

    const hookIso = ((lastHook.data ?? []) as unknown as Row[])[0] ? str(((lastHook.data ?? []) as unknown as Row[])[0], ['received_at']) : null
    const failed = failedHooks.count ?? 0
    health.push({ key: 'hook', label: 'KPay 通知（24 小時內失敗）', value: String(failed), tone: failed > 0 ? 'bad' : 'good', hint: `最近收到：${ago(hookIso)}`, href: '/admin/activity?type=webhook&problems=1' })

    const errRows = (errors.data ?? []) as unknown as Row[]
    const bySource = new Map<string, number>()
    for (const r of errRows) {
      const s = str(r, ['source']) ?? '未知'
      bySource.set(s, (bySource.get(s) ?? 0) + 1)
    }
    const top = [...bySource.entries()].sort((a, b) => b[1] - a[1])[0]
    health.push({ key: 'err', label: '未解決錯誤（24 小時）', value: String(errRows.length), tone: errRows.length > 20 ? 'bad' : errRows.length > 0 ? 'warn' : 'good', hint: top ? `最多：${top[0]}（${top[1]}）` : '沒有錯誤', href: '/admin/activity?type=error' })

    const wa = waPending.count ?? 0
    health.push({ key: 'wa', label: 'WhatsApp 通知未發送', value: String(wa), tone: wa > 0 ? 'warn' : 'good', hint: wa > 0 ? '記錄為 pending，從未發出' : '全部已發送', href: '/admin/activity?type=notify&problems=1&hours=168' })

    const st = stuck.count ?? 0
    health.push({ key: 'stuck', label: '待付款超過 30 分鐘', value: String(st), tone: st > 0 ? 'warn' : 'good', hint: st > 0 ? '可能未被自動釋放' : '沒有卡住的預約', href: '/admin/payment-log' })

    const rv = review.count ?? 0
    health.push({ key: 'review', label: '付款待審核', value: String(rv), tone: rv > 0 ? 'bad' : 'good', hint: rv > 0 ? '需人手確認' : '沒有', href: '/admin/payment-log' })
  } catch (err) {
    failures.push('系統狀態載入失敗')
    console.error('[admin/activity] health failed', err)
  }

  return {
    filter,
    hours,
    problemsOnly,
    items: shown.slice(0, 400),
    counts,
    health,
    error: failures.length > 0 ? failures.join('；') : null,
  }
}
