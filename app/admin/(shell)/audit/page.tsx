'use client'

/**
 * Admin Audit Log — §10.3.
 *
 * Paginated table of audit_log entries.
 * Columns: timestamp | admin email | action | target | details
 * Features: filters (admin email, action type, date range), CSV export.
 * Passwords always "[REDACTED]" — redaction happens server-side.
 *
 * Design system: admin-theme.css variables only.
 * NO inline hex, NO shadows, NO `any`.
 */

import { useState, useEffect, useCallback } from 'react'

/* ── Types ────────────────────────────────────────────── */
type AuditRow = {
  id: string
  adminId: string
  adminEmail: string
  actionType: string
  targetTable: string | null
  targetId: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  riskLevel: string | null
  createdAt: string
}

type AuditResponse = {
  rows: AuditRow[]
  total: number
  page: number
  pageSize: number
}

/* ── Action type labels ─────────────────────────────── */
const ACTION_LABELS: Record<string, string> = {
  member_adjust_points: '調整積分',
  member_adjust_credit: '調整儲值金',
  member_set_tier: '設定級別',
  member_blacklist: '加入黑名單',
  member_unblacklist: '移出黑名單',
  member_identity_change: '更改會員身分',
  member_hidden: '隱藏帳戶',
  member_unhidden: '取消隱藏帳戶',
  booking_cancel: '取消預約',
  booking_confirm: '確認預約',
  booking_manual_create: '手動建立預約',
  booking_reschedule: '更改預約時間',
  booking_weather_reschedule: '天氣原因改期',
  coupon_create: '建立優惠券',
  coupon_update: '更新優惠券',
  promo_code_created: '建立優惠碼',
  promo_code_updated: '更新優惠碼',
  promo_code_enabled: '啟用優惠碼',
  revenue_export: '匯出收入報表',
  user_update: '更新用戶',
  ai_propose: 'AI 建議',
  ai_confirm: 'AI 確認',
  payment_issue_mark: '標記付款異常',
  payment_reconcile: '付款對賬',
  admin_test_mode_on: '開啟測試模式',
  admin_test_mode_off: '關閉測試模式',
  admin_email_sent: '發送電郵',
}

function formatActionType(raw: string): string {
  return ACTION_LABELS[raw] ?? raw
}

const RISK_LABEL: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
}

/* ── Main component ─────────────────────────────────── */
export default function AuditLogPage() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  // Filters
  const [adminEmail, setAdminEmail] = useState('')
  const [actionType, setActionType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const pageSize = 50
  const totalPages = Math.ceil(total / pageSize)

  const fetchLogs = useCallback(async (p: number) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p) })
    if (adminEmail) params.set('admin_email', adminEmail)
    if (actionType) params.set('action_type', actionType)
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)

    try {
      const res = await fetch(`/api/admin/audit?${params}`)
      if (!res.ok) throw new Error('載入失敗')
      const data: AuditResponse = await res.json()
      setRows(data.rows)
      setTotal(data.total)
    } catch (err) {
      console.error('[audit] fetch error', err)
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [adminEmail, actionType, dateFrom, dateTo])

  // Fetch on mount and filter change
  useEffect(() => {
    setPage(1)
    fetchLogs(1)
  }, [fetchLogs])

  const handleSearch = () => {
    setPage(1)
    fetchLogs(1)
  }

  const handleExportCSV = () => {
    if (rows.length === 0) return

    const headers = ['時間', '管理員電郵', '動作', '對象表', '對象編號', '風險', '之前', '之後']
    const csvRows = rows.map((r) => [
      r.createdAt,
      r.adminEmail,
      formatActionType(r.actionType),
      r.targetTable ?? '',
      r.targetId ?? '',
      r.riskLevel ?? '',
      JSON.stringify(r.before ?? {}),
      JSON.stringify(r.after ?? {}),
    ])

    const csv = [headers, ...csvRows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const uniqueActions = [...new Set(rows.map((r) => r.actionType))].sort()
  const riskTone = (r: string | null): 'warn' | 'bad' | undefined => (r === 'high' ? 'bad' : r === 'medium' ? 'warn' : undefined)

  return (
    <div className="admin-stack">
      <section className="admin-card">
        <form
          className="ad-filters"
          onSubmit={(e) => { e.preventDefault(); handleSearch() }}
        >
          <label className="ad-field">
            <span>管理員電郵</span>
            <input className="ad-input" type="text" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="以電郵篩選…" />
          </label>
          <label className="ad-field">
            <span>動作類型</span>
            <select className="ad-input" value={actionType} onChange={(e) => setActionType(e.target.value)}>
              <option value="">所有動作</option>
              {uniqueActions.map((a) => (
                <option key={a} value={a}>{formatActionType(a)}</option>
              ))}
            </select>
          </label>
          <label className="ad-field">
            <span>開始日期</span>
            <input className="ad-input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label className="ad-field">
            <span>結束日期</span>
            <input className="ad-input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <button type="submit" className="ad-btn ad-btn-primary">搜尋</button>
          <button type="button" className="ad-btn" onClick={handleExportCSV} disabled={rows.length === 0}>匯出 CSV</button>
        </form>

        <div className="ad-table-wrap" style={{ borderTop: '1px solid var(--admin-border-subtle)' }}>
          {loading ? (
            <p className="ad-empty">載入中…</p>
          ) : rows.length === 0 ? (
            <p className="ad-empty">沒有審計紀錄</p>
          ) : (
            <table className="ad-table">
              <thead>
                <tr><th>時間</th><th>管理員</th><th>動作</th><th>對象</th><th>風險</th><th>詳情</th></tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="時間" className="ad-muted" style={{ whiteSpace: 'nowrap' }}>
                      {new Date(row.createdAt).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                    </td>
                    <td data-label="管理員" style={{ fontWeight: 600, minWidth: 200, overflowWrap: 'break-word' }}>{row.adminEmail}</td>
                    <td data-label="動作"><span className="ad-chip">{formatActionType(row.actionType)}</span></td>
                    <td data-label="對象" className="ad-muted">
                      {row.targetTable}
                      {row.targetId ? <span className="ad-mono"> {row.targetId.slice(0, 8)}…</span> : null}
                    </td>
                    <td data-label="風險">
                      {row.riskLevel ? <span className="ad-chip" data-tone={riskTone(row.riskLevel)}>{RISK_LABEL[row.riskLevel] ?? row.riskLevel}</span> : null}
                    </td>
                    <td data-label="詳情">
                      {row.after ? (
                        <details className="ad-details">
                          <summary style={{ whiteSpace: 'nowrap' }}>查看</summary>
                          <pre>{JSON.stringify(row.after, null, 2)}</pre>
                        </details>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="ad-pager">
            <span>第 {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} 項，共 {total} 項</span>
            <div className="ad-pager-ctl">
              <button type="button" className="ad-btn" disabled={page === 1} onClick={() => { setPage(page - 1); fetchLogs(page - 1) }}>上一頁</button>
              <span>{page} / {totalPages}</span>
              <button type="button" className="ad-btn" disabled={page === totalPages} onClick={() => { setPage(page + 1); fetchLogs(page + 1) }}>下一頁</button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
