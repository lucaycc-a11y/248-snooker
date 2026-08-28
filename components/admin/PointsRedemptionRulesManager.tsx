'use client'

import { useEffect, useState, useCallback } from 'react'
import { tokens } from '@/app/styles/tokens'

type Rule = {
  id: string
  points_required: number
  discount_amount: number
  display_order: number
  is_active: boolean
}

export default function PointsRedemptionRulesManager() {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ points_required: '', discount_amount: '', display_order: '0' })
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/points-rules')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to load')
      setRules(json.rules ?? [])
    } catch (e) {
      setError((e as Error).message)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const toggle = async (id: string, is_active: boolean) => {
    await fetch(`/api/admin/points-rules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active }),
    })
    await load()
  }

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const pts = parseInt(form.points_required, 10)
    const disc = parseFloat(form.discount_amount)
    if (!pts || pts <= 0) { setFormError('Points must be a positive integer'); return }
    if (isNaN(disc) || disc < 0) { setFormError('Discount must be non-negative'); return }
    setCreating(true)
    const res = await fetch('/api/admin/points-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points_required: pts, discount_amount: disc, display_order: parseInt(form.display_order, 10) || 0 }),
    })
    const json = await res.json()
    setCreating(false)
    if (!res.ok) { setFormError(json.error ?? 'Failed to create'); return }
    setForm({ points_required: '', discount_amount: '', display_order: '0' })
    await load()
  }

  const cellStyle: React.CSSProperties = { padding: '12px 16px', fontSize: 14, borderBottom: `1px solid ${tokens.colors.border}` }
  const headStyle: React.CSSProperties = { ...cellStyle, color: tokens.colors.textMuted, fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }

  return (
    <div style={{ color: tokens.colors.text }}>
      {error && <p style={{ color: '#f87171', marginBottom: 16 }}>{error}</p>}

      {/* Rule list */}
      <div style={{ background: tokens.colors.surface, border: `1px solid ${tokens.colors.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 32 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
              <th style={headStyle}>Points</th>
              <th style={headStyle}>Discount (HK$)</th>
              <th style={headStyle}>Order</th>
              <th style={headStyle}>Status</th>
              <th style={headStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ ...cellStyle, textAlign: 'center', color: tokens.colors.textMuted }}>Loading...</td></tr>
            ) : rules.length === 0 ? (
              <tr><td colSpan={5} style={{ ...cellStyle, textAlign: 'center', color: tokens.colors.textMuted }}>No rules yet</td></tr>
            ) : rules.map((r) => (
              <tr key={r.id}>
                <td style={cellStyle}>{r.points_required} pts</td>
                <td style={cellStyle}>HK${r.discount_amount}</td>
                <td style={cellStyle}>{r.display_order}</td>
                <td style={cellStyle}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: r.is_active ? '#22c55e' : tokens.colors.textMuted }}>
                    {r.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={cellStyle}>
                  <button
                    type="button"
                    onClick={() => toggle(r.id, !r.is_active)}
                    style={{
                      fontSize: 13, fontWeight: 600, padding: '4px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: r.is_active ? 'rgba(248,113,113,0.12)' : 'rgba(34,197,94,0.12)',
                      color: r.is_active ? '#f87171' : '#22c55e',
                    }}
                  >
                    {r.is_active ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create form */}
      <div style={{ background: tokens.colors.surface, border: `1px solid ${tokens.colors.border}`, borderRadius: 12, padding: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, marginTop: 0 }}>Add Rule</h2>
        <form onSubmit={create} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(['points_required', 'discount_amount', 'display_order'] as const).map((field) => (
            <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label htmlFor={field} style={{ fontSize: 13, color: tokens.colors.textMuted }}>
                {field === 'points_required' ? 'Points required' : field === 'discount_amount' ? 'Discount amount (HK$)' : 'Display order'}
              </label>
              <input
                id={field}
                type="number"
                value={form[field]}
                onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: `1px solid ${tokens.colors.border}`, borderRadius: 8,
                  padding: '10px 14px', color: tokens.colors.text, fontSize: 14, maxWidth: 240,
                }}
              />
            </div>
          ))}
          {formError && <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>{formError}</p>}
          <button
            type="submit"
            disabled={creating}
            style={{
              alignSelf: 'flex-start', padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: '#22c55e', color: '#000', fontWeight: 700, fontSize: 14, opacity: creating ? 0.6 : 1,
              minHeight: 44,
            }}
          >
            {creating ? 'Adding...' : 'Add Rule'}
          </button>
        </form>
      </div>
    </div>
  )
}
