'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  audienceLabel,
  discountLabel,
  statusLabel,
  weekdayLabel,
  ISO_WEEKDAYS,
  type NormalizedPromoCode,
  type PromoTimeWindow,
} from '@/lib/admin/promo-code-rules'

/**
 * 網站資料 → 「優惠碼」 — full management of `promotion_codes`, the table
 * `prepare_checkout` reads at payment time.
 *
 * List / create / edit / enable / disable. **Never delete**: a removed code
 * strands `promo_code_usages` and erases what the customer actually paid, so
 * the API answers 405 and this UI offers no delete control.
 *
 * `coupon_templates` / `user_coupons` are a different feature and are not
 * touched here.
 */

type PromoRow = {
  id: string
  code: string
  name: string | null
  discount_type: string
  discount_value: number
  status: string | null
  is_active: boolean | null
  audience: string | null
  audience_threshold: number | null
  max_uses: number | null
  used_count: number | null
  per_user_limit: number | null
  min_cart_amount: number | null
  max_discount: number | null
  valid_from: string | null
  valid_until: string | null
  stackable_with_credits: boolean | null
  stackable_with_other_codes: boolean | null
  /** ISO day-of-week ints (1=Mon…7=Sun) — see `extract(isodow FROM b.date)`. */
  weekdays: number[] | null
  /** `[{ start: 'HH:MM', end: 'HH:MM' }]` — what `prepare_checkout` iterates. */
  time_windows: unknown
  created_at: string | null
}

type ListState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; rows: PromoRow[] }

type FormState = {
  code: string
  name: string
  discountType: 'percentage' | 'fixed_amount'
  discountValue: string
  status: 'draft' | 'active' | 'disabled'
  audience: 'all' | 'new_users' | 'min_orders' | 'min_spend'
  audienceThreshold: string
  maxUses: string
  perUserLimit: string
  minCartAmount: string
  maxDiscount: string
  validFrom: string
  validUntil: string
  stackableWithCredits: boolean
  stackableWithOtherCodes: boolean
  /** ISO day-of-week, 1=Mon…7=Sun. Empty array = any day. */
  weekdays: number[]
  /** Empty array = any time. End < start is a legal overnight window. */
  timeWindows: PromoTimeWindow[]
}

const EMPTY_FORM: FormState = {
  code: '',
  name: '',
  discountType: 'percentage',
  discountValue: '',
  status: 'draft',
  audience: 'all',
  audienceThreshold: '',
  maxUses: '',
  perUserLimit: '',
  minCartAmount: '',
  maxDiscount: '',
  validFrom: '',
  validUntil: '',
  stackableWithCredits: true,
  stackableWithOtherCodes: false,
  weekdays: [],
  timeWindows: [],
}

function toDateInput(iso: string | null): string {
  if (!iso) return ''
  // `valid_from` / `valid_until` are timestamptz and come back in UTC. The form
  // is a Hong Kong calendar date, so shift to UTC+8 before taking the day —
  // otherwise 2026-10-01T00:00+08:00 reopens as 2026-09-30.
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  const hk = new Date(d.getTime() + 8 * 60 * 60 * 1000)
  return hk.toISOString().slice(0, 10)
}

function parseWeekdays(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  const out = new Set<number>()
  for (const raw of value) {
    const n = typeof raw === 'number' ? raw : Number(raw)
    if (Number.isInteger(n) && n >= 1 && n <= 7) out.add(n)
  }
  return Array.from(out).sort((a, b) => a - b)
}

function parseTimeWindows(value: unknown): PromoTimeWindow[] {
  if (!Array.isArray(value)) return []
  const out: PromoTimeWindow[] = []
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) continue
    const rec = raw as Record<string, unknown>
    const start = typeof rec.start === 'string' ? rec.start : ''
    const end = typeof rec.end === 'string' ? rec.end : ''
    if (start && end) out.push({ start, end })
  }
  return out
}

function rowToForm(row: PromoRow): FormState {
  return {
    code: row.code,
    name: row.name ?? '',
    discountType: row.discount_type === 'fixed_amount' ? 'fixed_amount' : 'percentage',
    discountValue: String(row.discount_value ?? ''),
    status: row.status === 'active' || row.status === 'disabled' ? row.status : 'draft',
    audience:
      row.audience === 'new_users' || row.audience === 'min_orders' || row.audience === 'min_spend'
        ? row.audience
        : 'all',
    audienceThreshold: row.audience_threshold != null ? String(row.audience_threshold) : '',
    maxUses: row.max_uses != null ? String(row.max_uses) : '',
    perUserLimit: row.per_user_limit != null ? String(row.per_user_limit) : '',
    minCartAmount: row.min_cart_amount != null ? String(row.min_cart_amount) : '',
    maxDiscount: row.max_discount != null ? String(row.max_discount) : '',
    validFrom: toDateInput(row.valid_from),
    validUntil: toDateInput(row.valid_until),
    stackableWithCredits: row.stackable_with_credits !== false,
    stackableWithOtherCodes: row.stackable_with_other_codes === true,
    weekdays: parseWeekdays(row.weekdays),
    timeWindows: parseTimeWindows(row.time_windows),
  }
}

function formToBody(form: FormState): Record<string, unknown> {
  return {
    code: form.code.trim().toUpperCase(),
    name: form.name.trim(),
    discount_type: form.discountType,
    discount_value: Number(form.discountValue),
    status: form.status,
    audience: form.audience,
    audience_threshold:
      form.audience === 'min_orders' || form.audience === 'min_spend'
        ? Number(form.audienceThreshold)
        : null,
    max_uses: form.maxUses.trim() === '' ? null : Number(form.maxUses),
    per_user_limit: form.perUserLimit.trim() === '' ? null : Number(form.perUserLimit),
    min_cart_amount: form.minCartAmount.trim() === '' ? null : Number(form.minCartAmount),
    max_discount: form.maxDiscount.trim() === '' ? null : Number(form.maxDiscount),
    valid_from: form.validFrom ? `${form.validFrom}T00:00:00+08:00` : null,
    valid_until: form.validUntil ? `${form.validUntil}T23:59:59+08:00` : null,
    stackable_with_credits: form.stackableWithCredits,
    stackable_with_other_codes: form.stackableWithOtherCodes,
    // Empty = unrestricted. `prepare_checkout` treats NULL and `[]` the same
    // (`array_length … > 0` / `jsonb_array_length … > 0`), so write NULL.
    weekdays: form.weekdays.length > 0 ? form.weekdays : null,
    time_windows: form.timeWindows.length > 0 ? form.timeWindows : null,
  }
}

const STATUS_CLASS: Record<string, string> = {
  active: 'admin-tag',
  draft: 'admin-tag warn',
  disabled: 'admin-tag bad',
}

export default function PromotionCodesManager() {
  const [state, setState] = useState<ListState>({ kind: 'loading' })
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setState({ kind: 'loading' })
    try {
      const res = await fetch('/api/admin/promos')
      const json = (await res.json()) as { error?: string; codes?: PromoRow[] }
      if (!res.ok || json.error) {
        setState({ kind: 'error', message: json.error ?? '優惠碼資料載入失敗' })
        return
      }
      setState({ kind: 'ready', rows: json.codes ?? [] })
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : '優惠碼資料載入失敗' })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(t)
  }, [notice])

  function startCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFailure(null)
    setShowForm(true)
  }

  function startEdit(row: PromoRow) {
    setEditingId(row.id)
    setForm(rowToForm(row))
    setFailure(null)
    setShowForm(true)
  }

  async function submit() {
    setBusy(true)
    setFailure(null)
    try {
      const body = formToBody(form)
      const res = await fetch(editingId ? `/api/admin/promos/${editingId}` : '/api/admin/promos', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok || json.error) {
        setFailure(json.error ?? '儲存失敗')
        return
      }
      setNotice(editingId ? '優惠碼已更新' : '優惠碼已建立')
      setShowForm(false)
      setEditingId(null)
      setForm(EMPTY_FORM)
      await load()
    } catch (e) {
      setFailure(e instanceof Error ? e.message : '儲存失敗')
    } finally {
      setBusy(false)
    }
  }

  async function setStatus(row: PromoRow, status: 'active' | 'disabled') {
    setBusy(true)
    setFailure(null)
    try {
      const res = await fetch(`/api/admin/promos/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok || json.error) {
        setFailure(json.error ?? '更新失敗')
        return
      }
      setNotice(status === 'active' ? '優惠碼已啟用' : '優惠碼已停用')
      await load()
    } catch (e) {
      setFailure(e instanceof Error ? e.message : '更新失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="admin-card admin-stack" style={{ gap: 16 }}>
      <div className="admin-toolbar" style={{ justifyContent: 'space-between' }}>
        <h2 className="admin-ptitle" data-cms-key="admin.promos.codes.title">
          優惠碼管理
        </h2>
        <button type="button" className="admin-btn" onClick={startCreate} data-cms-key="admin.promos.codes.create">
          新增優惠碼
        </button>
      </div>

      <p className="admin-note" data-cms-key="admin.promos.codes.note">
        這些是結帳時使用的優惠碼（promotion_codes）。優惠碼不能刪除，只能停用，以保留使用紀錄。
      </p>

      {failure ? (
        <div className="admin-card" role="alert" style={{ borderColor: 'var(--admin-danger)' }}>
          <p style={{ color: 'var(--admin-danger)' }} data-cms-key="admin.promos.codes.failure">
            {failure}
          </p>
        </div>
      ) : null}
      {notice ? (
        <p className="admin-note" role="status" data-cms-key="admin.promos.codes.notice">
          {notice}
        </p>
      ) : null}

      {showForm ? (
        <div className="admin-card admin-stack" style={{ gap: 12 }}>
          <h3 className="admin-ptitle" style={{ fontSize: 18 }} data-cms-key="admin.promos.codes.form_title">
            {editingId ? '編輯優惠碼' : '新增優惠碼'}
          </h3>

          <div className="admin-grid2">
            <label className="admin-field">
              <span className="admin-lbl" data-cms-key="admin.promos.codes.field_code">
                優惠碼
              </span>
              <input
                className="admin-input"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="例如 S8-OPEN"
                maxLength={20}
                disabled={busy}
              />
            </label>

            <label className="admin-field">
              <span className="admin-lbl" data-cms-key="admin.promos.codes.field_name">
                名稱
              </span>
              <input
                className="admin-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例如 開幕優惠"
                disabled={busy}
              />
            </label>

            <label className="admin-field">
              <span className="admin-lbl" data-cms-key="admin.promos.codes.field_discount_type">
                折扣類型
              </span>
              <select
                className="admin-sel"
                value={form.discountType}
                onChange={(e) =>
                  setForm({ ...form, discountType: e.target.value as FormState['discountType'] })
                }
                disabled={busy}
              >
                <option value="percentage">百分比（%）</option>
                <option value="fixed_amount">固定金額（HK$）</option>
              </select>
            </label>

            <label className="admin-field">
              <span className="admin-lbl" data-cms-key="admin.promos.codes.field_discount_value">
                折扣數值
              </span>
              <input
                className="admin-input"
                type="number"
                min={1}
                max={form.discountType === 'percentage' ? 100 : undefined}
                step={1}
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                disabled={busy}
              />
            </label>

            <label className="admin-field">
              <span className="admin-lbl" data-cms-key="admin.promos.codes.field_status">
                狀態
              </span>
              <select
                className="admin-sel"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as FormState['status'] })}
                disabled={busy}
              >
                <option value="draft">草稿</option>
                <option value="active">生效中</option>
                <option value="disabled">已停用</option>
              </select>
            </label>

            <label className="admin-field">
              <span className="admin-lbl" data-cms-key="admin.promos.codes.field_audience">
                適用對象
              </span>
              <select
                className="admin-sel"
                value={form.audience}
                onChange={(e) =>
                  setForm({ ...form, audience: e.target.value as FormState['audience'] })
                }
                disabled={busy}
              >
                <option value="all">全部</option>
                <option value="new_users">新會員</option>
                <option value="min_orders">最低訂單數</option>
                <option value="min_spend">最低消費</option>
              </select>
            </label>

            {form.audience === 'min_orders' || form.audience === 'min_spend' ? (
              <label className="admin-field">
                <span className="admin-lbl" data-cms-key="admin.promos.codes.field_threshold">
                  門檻
                </span>
                <input
                  className="admin-input"
                  type="number"
                  min={1}
                  step={1}
                  value={form.audienceThreshold}
                  onChange={(e) => setForm({ ...form, audienceThreshold: e.target.value })}
                  disabled={busy}
                />
              </label>
            ) : null}

            <label className="admin-field">
              <span className="admin-lbl" data-cms-key="admin.promos.codes.field_max_uses">
                使用次數上限
              </span>
              <input
                className="admin-input"
                type="number"
                min={1}
                step={1}
                value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                placeholder="不限"
                disabled={busy}
              />
            </label>

            <label className="admin-field">
              <span className="admin-lbl" data-cms-key="admin.promos.codes.field_per_user">
                每名會員上限
              </span>
              <input
                className="admin-input"
                type="number"
                min={1}
                step={1}
                value={form.perUserLimit}
                onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })}
                placeholder="不限"
                disabled={busy}
              />
            </label>

            <label className="admin-field">
              <span className="admin-lbl" data-cms-key="admin.promos.codes.field_min_cart">
                最低消費（HK$）
              </span>
              <input
                className="admin-input"
                type="number"
                min={0}
                step={1}
                value={form.minCartAmount}
                onChange={(e) => setForm({ ...form, minCartAmount: e.target.value })}
                placeholder="不限"
                disabled={busy}
              />
            </label>

            <label className="admin-field">
              <span className="admin-lbl" data-cms-key="admin.promos.codes.field_max_discount">
                折扣上限（HK$）
              </span>
              <input
                className="admin-input"
                type="number"
                min={1}
                step={1}
                value={form.maxDiscount}
                onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
                placeholder="不限"
                disabled={busy}
              />
            </label>

            <label className="admin-field">
              <span className="admin-lbl" data-cms-key="admin.promos.codes.field_valid_from">
                開始日期
              </span>
              <input
                className="admin-input"
                type="date"
                value={form.validFrom}
                onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                disabled={busy}
              />
            </label>

            <label className="admin-field">
              <span className="admin-lbl" data-cms-key="admin.promos.codes.field_valid_until">
                結束日期
              </span>
              <input
                className="admin-input"
                type="date"
                value={form.validUntil}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                disabled={busy}
              />
            </label>
          </div>

          <label className="admin-switch">
            <input
              type="checkbox"
              checked={form.stackableWithCredits}
              onChange={(e) => setForm({ ...form, stackableWithCredits: e.target.checked })}
              disabled={busy}
            />
            <span data-cms-key="admin.promos.codes.field_stackable">可與 Space Wallet Credit 同時使用</span>
          </label>

          <label className="admin-switch">
            <input
              type="checkbox"
              checked={form.stackableWithOtherCodes}
              onChange={(e) => setForm({ ...form, stackableWithOtherCodes: e.target.checked })}
              disabled={busy}
            />
            <span data-cms-key="admin.promos.codes.field_stackable_codes">可與其他優惠碼同時使用</span>
          </label>

          <div className="admin-field">
            <span className="admin-lbl" data-cms-key="admin.promos.codes.field_weekdays">
              適用星期
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
              {ISO_WEEKDAYS.map((dow) => {
                const on = form.weekdays.includes(dow)
                return (
                  <label key={dow} className="admin-switch" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? Array.from(new Set([...form.weekdays, dow])).sort((a, b) => a - b)
                          : form.weekdays.filter((d) => d !== dow)
                        setForm({ ...form, weekdays: next })
                      }}
                      disabled={busy}
                    />
                    <span data-cms-key={`admin.promos.codes.weekday_${dow}`}>{weekdayLabel(dow)}</span>
                  </label>
                )
              })}
            </div>
            <p className="admin-note" data-cms-key="admin.promos.codes.weekdays_note">
              不選任何日子即表示每天都適用。日子以香港時間計算。
            </p>
          </div>

          <div className="admin-field">
            <span className="admin-lbl" data-cms-key="admin.promos.codes.field_time_windows">
              適用時段
            </span>
            {form.timeWindows.length === 0 ? (
              <p className="admin-note" data-cms-key="admin.promos.codes.time_windows_empty">
                尚未設定時段，即表示任何時段都適用。
              </p>
            ) : (
              form.timeWindows.map((w, i) => (
                <div key={`tw-${i}`} className="admin-toolbar" style={{ gap: 8, alignItems: 'center' }}>
                  <input
                    className="admin-input"
                    type="time"
                    value={w.start}
                    onChange={(e) => {
                      const next = form.timeWindows.map((x, j) => (j === i ? { ...x, start: e.target.value } : x))
                      setForm({ ...form, timeWindows: next })
                    }}
                    disabled={busy}
                    aria-label={`開始時間 ${i + 1}`}
                  />
                  <span className="admin-muted" data-cms-key="admin.promos.codes.time_to">
                    至
                  </span>
                  <input
                    className="admin-input"
                    type="time"
                    value={w.end}
                    onChange={(e) => {
                      const next = form.timeWindows.map((x, j) => (j === i ? { ...x, end: e.target.value } : x))
                      setForm({ ...form, timeWindows: next })
                    }}
                    disabled={busy}
                    aria-label={`結束時間 ${i + 1}`}
                  />
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={() => setForm({ ...form, timeWindows: form.timeWindows.filter((_, j) => j !== i) })}
                    disabled={busy}
                    data-cms-key="admin.promos.codes.time_window_remove"
                  >
                    移除
                  </button>
                </div>
              ))
            )}
            <div className="admin-toolbar" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="admin-btn"
                onClick={() => setForm({ ...form, timeWindows: [...form.timeWindows, { start: '18:00', end: '23:00' }] })}
                disabled={busy}
                data-cms-key="admin.promos.codes.time_window_add"
              >
                新增時段
              </button>
            </div>
            <p className="admin-note" data-cms-key="admin.promos.codes.time_windows_note">
              預約必須完整落在其中一個時段內才可使用此優惠碼。結束時間早於開始時間代表跨午夜（例如 22:00 至 02:00）。
            </p>
          </div>

          <div className="admin-toolbar">
            <button type="button" className="admin-btn" onClick={() => void submit()} disabled={busy} data-cms-key="admin.promos.codes.save">
              {busy ? '儲存中…' : '儲存'}
            </button>
            <button
              type="button"
              className="admin-btn"
              onClick={() => {
                setShowForm(false)
                setEditingId(null)
                setFailure(null)
              }}
              disabled={busy}
              data-cms-key="admin.promos.codes.cancel"
            >
              取消
            </button>
          </div>
        </div>
      ) : null}

      {state.kind === 'loading' ? (
        <div className="admin-empty" role="status" data-cms-key="admin.promos.codes.loading">
          載入中…
        </div>
      ) : state.kind === 'error' ? (
        <div className="admin-card" role="alert" style={{ borderColor: 'var(--admin-danger)' }}>
          <div className="admin-ptitle" style={{ color: 'var(--admin-danger)' }} data-cms-key="admin.promos.codes.load_error">
            優惠碼資料載入失敗
          </div>
          <p className="admin-muted">{state.message}</p>
        </div>
      ) : state.rows.length === 0 ? (
        <div className="admin-empty" data-cms-key="admin.promos.codes.empty">
          還沒有優惠碼
        </div>
      ) : (
        <div className="admin-scroll">
          <div
            className="overflow-x-auto rounded-2xl"
            style={{ background: 'var(--admin-glass-bg)', border: '1px solid var(--admin-border)' }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--admin-border)' }}>
                  {['優惠碼', '折扣', '狀態', '適用對象', '使用', '有效期', '操作'].map((label, i) => (
                    <th
                      key={label}
                      className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider"
                      style={{ color: 'var(--admin-text-muted)' }}
                      data-cms-key={`admin.promos.codes.col_${i}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.rows.map((row) => {
                  const status = row.status ?? (row.is_active ? 'active' : 'disabled')
                  const threshold =
                    row.audience === 'min_orders' || row.audience === 'min_spend'
                      ? `（${row.audience_threshold ?? 0}）`
                      : ''
                  const days = parseWeekdays(row.weekdays)
                  const windows = parseTimeWindows(row.time_windows)
                  return (
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--admin-border-subtle)' }}>
                      <td className="px-4 py-3">
                        <div className="font-mono text-sm font-semibold" style={{ color: 'var(--admin-text-primary)' }}>
                          {row.code}
                        </div>
                        {row.name ? (
                          <div className="text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>
                            {row.name}
                          </div>
                        ) : null}
                        {days.length > 0 || windows.length > 0 ? (
                          <div className="text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>
                            {days.length > 0 ? days.map(weekdayLabel).join('、') : null}
                            {days.length > 0 && windows.length > 0 ? ' · ' : null}
                            {windows.length > 0
                              ? windows.map((w) => `${w.start}–${w.end}`).join('、')
                              : null}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">{discountLabel(row.discount_type, row.discount_value)}</td>
                      <td className="px-4 py-3">
                        <span className={STATUS_CLASS[status] ?? 'admin-tag'}>{statusLabel(status)}</span>
                      </td>
                      <td className="px-4 py-3">
                        {audienceLabel(row.audience ?? 'all')}
                        {threshold}
                      </td>
                      <td className="px-4 py-3">
                        {row.used_count ?? 0}
                        {row.max_uses != null ? ` / ${row.max_uses}` : ''}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>
                        {toDateInput(row.valid_from) || '—'}
                        {' ~ '}
                        {toDateInput(row.valid_until) || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="admin-toolbar" style={{ gap: 6 }}>
                          <button
                            type="button"
                            className="admin-btn"
                            onClick={() => startEdit(row)}
                            disabled={busy}
                            data-cms-key="admin.promos.codes.edit"
                          >
                            編輯
                          </button>
                          {status === 'active' ? (
                            <button
                              type="button"
                              className="admin-btn"
                              onClick={() => void setStatus(row, 'disabled')}
                              disabled={busy}
                              data-cms-key="admin.promos.codes.disable"
                            >
                              停用
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="admin-btn"
                              onClick={() => void setStatus(row, 'active')}
                              disabled={busy}
                              data-cms-key="admin.promos.codes.enable"
                            >
                              啟用
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

// Keep the normalized type referenced so the form and the API share one shape.
export type { NormalizedPromoCode }
