'use client'

/**
 * PromoCodesManager — manages `promotion_codes`, the table checkout validates against.
 * Create / edit / enable / disable. Never deletes (usage history references codes).
 */

import { useCallback, useEffect, useState } from 'react'

type Code = {
  id: string
  code: string
  name: string | null
  discount_type: 'percentage' | 'fixed_amount'
  discount_value: number | string
  max_discount: number | string | null
  min_cart_amount: number | string | null
  max_uses: number | null
  per_user_limit: number | null
  audience: 'all' | 'new_users' | 'min_orders' | 'min_spend'
  audience_threshold: number | null
  valid_from: string
  valid_until: string | null
  status: 'draft' | 'active' | 'disabled'
  used_count: number
  usage_held: number
  usage_redeemed: number
  usage_discount: number
}

type Form = {
  code: string
  name: string
  discount_type: 'percentage' | 'fixed_amount'
  discount_value: string
  max_discount: string
  min_cart_amount: string
  max_uses: string
  per_user_limit: string
  audience: Code['audience']
  audience_threshold: string
  valid_from: string
  valid_until: string
  status: Code['status']
}

const EMPTY: Form = {
  code: '', name: '', discount_type: 'percentage', discount_value: '', max_discount: '',
  min_cart_amount: '', max_uses: '', per_user_limit: '', audience: 'all', audience_threshold: '',
  valid_from: '', valid_until: '', status: 'active',
}

const AUDIENCE_LABEL: Record<Code['audience'], string> = {
  all: '所有會員', new_users: '新會員', min_orders: '最少訂單數', min_spend: '最低累計消費',
}
const STATUS_LABEL: Record<Code['status'], string> = { draft: '草稿', active: '啟用中', disabled: '已停用' }

/** ISO → value for <input type="datetime-local"> in Hong Kong time. */
function toHkInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(new Date(iso).getTime() + 8 * 3600_000)
  return d.toISOString().slice(0, 16)
}
/** datetime-local value (HK time) → ISO. */
function fromHkInput(v: string): string | null {
  return v ? new Date(`${v}:00+08:00`).toISOString() : null
}
function fmtHk(iso: string | null): string {
  if (!iso) return '不限'
  return new Date(iso).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', hour12: false, dateStyle: 'short', timeStyle: 'short' })
}
function stateOf(c: Code): { label: string; tone: 'ok' | 'warn' | 'off' } {
  const now = Date.now()
  if (c.status === 'draft') return { label: '草稿', tone: 'off' }
  if (c.status === 'disabled') return { label: '已停用', tone: 'off' }
  if (c.valid_until && Date.parse(c.valid_until) <= now) return { label: '已過期', tone: 'warn' }
  if (Date.parse(c.valid_from) > now) return { label: '未開始', tone: 'warn' }
  if (c.max_uses !== null && Math.max(c.usage_redeemed + c.usage_held, c.used_count) >= c.max_uses) return { label: '已用完', tone: 'warn' }
  return { label: '使用中', tone: 'ok' }
}
const num = (v: number | string | null) => (v === null || v === '' ? '' : String(Number(v)))

export default function PromoCodesManager() {
  const [codes, setCodes] = useState<Code[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/admin/promos', { cache: 'no-store' })
      const data = (await res.json().catch(() => null)) as { codes?: Code[]; error?: string } | null
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      setCodes(data?.codes ?? [])
    } catch (e) {
      setLoadError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  function openNew() {
    setEditingId(null); setError(null)
    setForm({ ...EMPTY, valid_from: toHkInput(new Date().toISOString()) })
  }
  function openEdit(c: Code) {
    setEditingId(c.id); setError(null)
    setForm({
      code: c.code, name: c.name ?? '', discount_type: c.discount_type, discount_value: num(c.discount_value),
      max_discount: num(c.max_discount), min_cart_amount: num(c.min_cart_amount), max_uses: num(c.max_uses),
      per_user_limit: num(c.per_user_limit), audience: c.audience, audience_threshold: num(c.audience_threshold),
      valid_from: toHkInput(c.valid_from), valid_until: toHkInput(c.valid_until), status: c.status,
    })
  }

  async function save() {
    if (!form) return
    setSaving(true); setError(null)
    const payload = {
      code: form.code, name: form.name, discount_type: form.discount_type, discount_value: form.discount_value,
      max_discount: form.max_discount, min_cart_amount: form.min_cart_amount, max_uses: form.max_uses,
      per_user_limit: form.per_user_limit, audience: form.audience, audience_threshold: form.audience_threshold,
      valid_from: fromHkInput(form.valid_from), valid_until: fromHkInput(form.valid_until), status: form.status,
    }
    try {
      const res = await fetch(editingId ? `/api/admin/promos/${editingId}` : '/api/admin/promos', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) { setError(data?.error ?? `儲存失敗（${res.status}）`); return }
      setForm(null); setEditingId(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function setStatus(c: Code, status: Code['status']) {
    const res = await fetch(`/api/admin/promos/${c.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      alert(data?.error ?? '更新失敗')
      return
    }
    await load()
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f))
  const input = 'w-full rounded-md border px-3 py-2 text-sm'
  const inputStyle = { borderColor: 'var(--admin-border)', background: 'var(--admin-surface)', color: 'var(--admin-text)' }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>
          這裡的優惠碼就是結帳時會驗證的優惠碼。時間以香港時間計算。
        </p>
        <button
          onClick={openNew}
          className="rounded-md px-3 py-2 text-sm font-semibold"
          style={{ background: 'var(--admin-brand)', color: 'var(--admin-brand-text)' }}
        >
          ＋ 新增優惠碼
        </button>
      </div>

      {loadError && (
        <div className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: 'var(--admin-danger, #d33)', color: 'var(--admin-danger, #d33)' }}>
          讀取失敗：{loadError} <button className="underline" onClick={() => void load()}>重試</button>
        </div>
      )}

      {form && (
        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--admin-border)', background: 'var(--admin-surface)' }}>
          <h3 className="mb-3 text-base font-semibold" style={{ color: 'var(--admin-text)' }}>
            {editingId ? `編輯 ${form.code}` : '新增優惠碼'}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="優惠碼（4–20 位，A-Z 0-9 -）">
              <input className={input} style={inputStyle} value={form.code} disabled={!!editingId}
                onChange={(e) => set('code', e.target.value.toUpperCase())} />
            </Field>
            <Field label="名稱（內部備註）">
              <input className={input} style={inputStyle} value={form.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="折扣類型">
              <select className={input} style={inputStyle} value={form.discount_type}
                onChange={(e) => set('discount_type', e.target.value as Form['discount_type'])}>
                <option value="percentage">百分比（%）</option>
                <option value="fixed_amount">固定金額（HK$）</option>
              </select>
            </Field>
            <Field label={form.discount_type === 'percentage' ? '折扣（1–100 %）' : '折扣（HK$）'}>
              <input className={input} style={inputStyle} inputMode="numeric" value={form.discount_value}
                onChange={(e) => set('discount_value', e.target.value)} />
            </Field>
            {form.discount_type === 'percentage' && (
              <Field label="折扣上限 HK$（可留空）">
                <input className={input} style={inputStyle} inputMode="numeric" value={form.max_discount}
                  onChange={(e) => set('max_discount', e.target.value)} />
              </Field>
            )}
            <Field label="最低消費 HK$（可留空）">
              <input className={input} style={inputStyle} inputMode="numeric" value={form.min_cart_amount}
                onChange={(e) => set('min_cart_amount', e.target.value)} />
            </Field>
            <Field label="總使用次數（留空＝不限）">
              <input className={input} style={inputStyle} inputMode="numeric" value={form.max_uses}
                onChange={(e) => set('max_uses', e.target.value)} />
            </Field>
            <Field label="每人使用次數（留空＝不限）">
              <input className={input} style={inputStyle} inputMode="numeric" value={form.per_user_limit}
                onChange={(e) => set('per_user_limit', e.target.value)} />
            </Field>
            <Field label="適用對象">
              <select className={input} style={inputStyle} value={form.audience}
                onChange={(e) => set('audience', e.target.value as Form['audience'])}>
                {(Object.keys(AUDIENCE_LABEL) as Code['audience'][]).map((a) => (
                  <option key={a} value={a}>{AUDIENCE_LABEL[a]}</option>
                ))}
              </select>
            </Field>
            {(form.audience === 'min_orders' || form.audience === 'min_spend') && (
              <Field label={form.audience === 'min_orders' ? '最少訂單數' : '最低累計消費 HK$'}>
                <input className={input} style={inputStyle} inputMode="numeric" value={form.audience_threshold}
                  onChange={(e) => set('audience_threshold', e.target.value)} />
              </Field>
            )}
            <Field label="開始時間（香港）">
              <input type="datetime-local" className={input} style={inputStyle} value={form.valid_from}
                onChange={(e) => set('valid_from', e.target.value)} />
            </Field>
            <Field label="結束時間（香港，留空＝不限）">
              <input type="datetime-local" className={input} style={inputStyle} value={form.valid_until}
                onChange={(e) => set('valid_until', e.target.value)} />
            </Field>
            <Field label="狀態">
              <select className={input} style={inputStyle} value={form.status}
                onChange={(e) => set('status', e.target.value as Form['status'])}>
                {(Object.keys(STATUS_LABEL) as Code['status'][]).map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </Field>
          </div>
          {error && <p className="mt-3 text-sm" style={{ color: 'var(--admin-danger, #d33)' }}>{error}</p>}
          <div className="mt-4 flex gap-2">
            <button onClick={save} disabled={saving} className="rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50"
              style={{ background: 'var(--admin-brand)', color: 'var(--admin-brand-text)' }}>
              {saving ? '儲存中…' : '儲存'}
            </button>
            <button onClick={() => { setForm(null); setEditingId(null) }} className="rounded-md border px-4 py-2 text-sm"
              style={{ borderColor: 'var(--admin-border)', color: 'var(--admin-text)' }}>
              取消
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>載入中…</p>
      ) : codes.length === 0 && !loadError ? (
        <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>暫時沒有優惠碼。</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--admin-border)' }}>
          <table className="w-full text-sm" style={{ color: 'var(--admin-text)' }}>
            <thead>
              <tr style={{ color: 'var(--admin-text-muted)' }} className="text-left text-xs">
                {['優惠碼', '折扣', '適用對象', '有效期（香港）', '已用 / 上限', '已折扣', '狀態', ''].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => {
                const st = stateOf(c)
                const used = Math.max(c.usage_redeemed, c.used_count)
                return (
                  <tr key={c.id} className="border-t" style={{ borderColor: 'var(--admin-border)' }}>
                    <td className="px-3 py-2">
                      <div className="font-mono font-semibold">{c.code}</div>
                      {c.name && <div className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>{c.name}</div>}
                    </td>
                    <td className="px-3 py-2">
                      {c.discount_type === 'percentage' ? `${Number(c.discount_value)}%` : `HK$${Number(c.discount_value)}`}
                      {c.min_cart_amount ? <div className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>滿 HK${Number(c.min_cart_amount)}</div> : null}
                    </td>
                    <td className="px-3 py-2">
                      {AUDIENCE_LABEL[c.audience]}{c.audience_threshold ? `（${c.audience_threshold}）` : ''}
                      {c.per_user_limit ? <div className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>每人 {c.per_user_limit} 次</div> : null}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">{fmtHk(c.valid_from)}<br />→ {fmtHk(c.valid_until)}</td>
                    <td className="px-3 py-2">
                      {used} / {c.max_uses ?? '∞'}
                      {c.usage_held > 0 && <div className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>保留中 {c.usage_held}</div>}
                    </td>
                    <td className="px-3 py-2">HK${c.usage_discount}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          background: st.tone === 'ok' ? 'var(--admin-brand)' : 'transparent',
                          color: st.tone === 'ok' ? 'var(--admin-brand-text)' : 'var(--admin-text-muted)',
                          border: st.tone === 'ok' ? 'none' : '1px solid var(--admin-border)',
                        }}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right">
                      <button className="mr-2 underline" onClick={() => openEdit(c)}>編輯</button>
                      {c.status === 'active' ? (
                        <button className="underline" onClick={() => { if (confirm(`停用 ${c.code}？結帳時將不能再使用。`)) void setStatus(c, 'disabled') }}>停用</button>
                      ) : (
                        <button className="underline" onClick={() => void setStatus(c, 'active')}>啟用</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium" style={{ color: 'var(--admin-text-muted)' }}>{label}</span>
      {children}
    </label>
  )
}
