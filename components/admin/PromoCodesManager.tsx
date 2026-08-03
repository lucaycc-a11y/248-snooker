'use client'

import { useState, useEffect } from 'react'
import { Plus, X, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { tokens } from '@/app/styles/tokens'

type PromoCode = {
  id: string
  code: string
  discount_type: 'percentage' | 'fixed_amount'
  discount_value: number
  max_uses: number | null
  used_count: number
  min_cart_amount: number | null
  valid_from: string
  valid_until: string | null
  is_active: boolean
  created_at: string
}

const TEXT = '#FFFFFF'
const MUTED = '#A1A1A6'
const GREEN = '#22C55E'
const DANGER = '#FF453A'
const BORDER = 'rgba(255,255,255,0.1)'
const GLASS_BG = 'rgba(255,255,255,0.05)'

export default function PromoCodesManager() {
  const [codes, setCodes] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    code: '',
    discount_type: 'percentage' as 'percentage' | 'fixed_amount',
    discount_value: '',
    max_uses: '',
    valid_until: '',
    min_cart_amount: '',
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { loadCodes() }, [])

  async function loadCodes() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/promos')
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setCodes(data.codes ?? [])
    } catch (e) {
      console.error('[promos] load error', e)
    } finally {
      setLoading(false)
    }
  }

  async function toggleActive(id: string, current: boolean) {
    const res = await fetch(`/api/admin/promos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !current }),
    })
    if (res.ok) loadCodes()
  }

  async function deleteCode(id: string) {
    if (!confirm('Delete this promo code?')) return
    const res = await fetch(`/api/admin/promos/${id}`, { method: 'DELETE' })
    if (res.ok) loadCodes()
  }

  async function createCode() {
    setError(null)
    if (!form.code.trim() || !form.discount_value) {
      setError('Code and discount value are required')
      return
    }

    const body: Record<string, unknown> = {
      code: form.code.trim(),
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value),
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
      min_cart_amount: form.min_cart_amount ? parseFloat(form.min_cart_amount) : null,
    }

    const res = await fetch('/api/admin/promos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed to create')
      return
    }

    setShowForm(false)
    setForm({ code: '', discount_type: 'percentage', discount_value: '', max_uses: '', valid_until: '', min_cart_amount: '' })
    loadCodes()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>Promotion Codes</h2>
        <Button variant="primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={16} style={{ marginRight: 6 }} />
          {showForm ? 'Cancel' : 'New Code'}
        </Button>
      </div>

      {showForm && (
        <Card variant="gradient" style={{ padding: '20px', marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: MUTED, marginBottom: 4, display: 'block' }}>Code</label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. SUMMER20" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: MUTED, marginBottom: 4, display: 'block' }}>Type</label>
              <select
                value={form.discount_type}
                onChange={(e) => setForm({ ...form, discount_type: e.target.value as 'percentage' | 'fixed_amount' })}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 12, border: `1px solid ${BORDER}`,
                  background: GLASS_BG, color: TEXT, fontSize: 14,
                }}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed_amount">Fixed Amount (HK$)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: MUTED, marginBottom: 4, display: 'block' }}>Value</label>
              <Input value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} placeholder={form.discount_type === 'percentage' ? 'e.g. 20' : 'e.g. 50'} type="number" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: MUTED, marginBottom: 4, display: 'block' }}>Max Uses</label>
              <Input value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} placeholder="Unlimited" type="number" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: MUTED, marginBottom: 4, display: 'block' }}>Valid Until</label>
              <Input value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} type="date" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: MUTED, marginBottom: 4, display: 'block' }}>Min Cart Amount (HK$)</label>
              <Input value={form.min_cart_amount} onChange={(e) => setForm({ ...form, min_cart_amount: e.target.value })} placeholder="None" type="number" />
            </div>
          </div>
          {error && <p style={{ color: DANGER, fontSize: 13, marginTop: 8 }}>{error}</p>}
          <div style={{ marginTop: 12 }}>
            <Button variant="primary" onClick={createCode}>Create Code</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <p style={{ color: MUTED, fontSize: 14 }}>Loading...</p>
      ) : codes.length === 0 ? (
        <p style={{ color: MUTED, fontSize: 14 }}>No promotion codes yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {codes.map((code) => (
            <Card key={code.id} variant="gradient" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: code.is_active ? GREEN : MUTED, fontFamily: 'monospace' }}>
                      {code.code}
                    </span>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 999,
                      background: code.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                      color: code.is_active ? GREEN : MUTED,
                    }}>
                      {code.discount_type === 'percentage' ? `${code.discount_value}% off` : `HK$${code.discount_value} off`}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: MUTED }}>
                    Used {code.used_count}{code.max_uses ? ` / ${code.max_uses}` : ''} times
                    {code.valid_until ? ` · Expires ${new Date(code.valid_until).toLocaleDateString()}` : ''}
                    {code.min_cart_amount ? ` · Min HK$${code.min_cart_amount}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => toggleActive(code.id, code.is_active)}
                    style={{ background: 'none', border: 'none', color: code.is_active ? GREEN : MUTED, cursor: 'pointer' }}
                    title={code.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {code.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteCode(code.id)}
                    style={{ background: 'none', border: 'none', color: DANGER, cursor: 'pointer' }}
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}