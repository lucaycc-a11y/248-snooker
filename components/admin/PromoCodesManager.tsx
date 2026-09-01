'use client'

/**
 * PromoCodesManager — Phase 8 coupon & campaign management UI.
 *
 * Manages the NEW coupon_templates / campaigns tables (spec §8).
 * The legacy promotion_codes system (checkout-facing) is surfaced
 * read-only at the bottom — never written from here.
 *
 * Design: admin-theme.css variables only, no inline hex, no shadows.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  Plus, X, Ticket, Megaphone, Check, Ban, Trash2, ChevronDown,
} from 'lucide-react'
import CouponTicket, { type CouponTicketData } from './CouponTicket'

type CouponTemplate = {
  id: string
  name: string
  discountType: string
  discountValue: number
  maxUses: number | null
  usedCount: number
  validFrom: string | null
  validUntil: string | null
  isActive: boolean
  createdAt: string | null
  issuedCount: number
}

type Campaign = {
  id: string
  name: string
  description: string | null
  startsAt: string | null
  endsAt: string | null
  status: string
  claimCount: number
}

type Tab = 'coupons' | 'campaigns'

const EMPTY_COUPON_FORM = {
  name: '',
  discountType: 'percentage' as 'percentage' | 'fixed',
  discountValue: '',
  maxUses: '',
  validUntil: '',
}

const EMPTY_CAMPAIGN_FORM = {
  name: '',
  description: '',
  startsAt: '',
  endsAt: '',
  status: 'draft',
}

export default function PromoCodesManager() {
  const [tab, setTab] = useState<Tab>('coupons')

  // ── Coupons state ─────────────────────────────────────────────
  const [coupons, setCoupons] = useState<CouponTemplate[]>([])
  const [couponsLoading, setCouponsLoading] = useState(true)
  const [showCouponForm, setShowCouponForm] = useState(false)
  const [couponForm, setCouponForm] = useState(EMPTY_COUPON_FORM)
  const [couponError, setCouponError] = useState<string | null>(null)

  // ── Campaigns state ───────────────────────────────────────────
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(true)
  const [showCampaignForm, setShowCampaignForm] = useState(false)
  const [campaignForm, setCampaignForm] = useState(EMPTY_CAMPAIGN_FORM)
  const [campaignError, setCampaignError] = useState<string | null>(null)

  const loadCoupons = useCallback(async () => {
    setCouponsLoading(true)
    try {
      const res = await fetch('/api/admin/coupons')
      if (!res.ok) throw new Error('Failed to load coupons')
      const data = await res.json()
      setCoupons((data.coupons ?? []) as CouponTemplate[])
    } catch (err) {
      console.error('[coupons] load error', err)
    } finally {
      setCouponsLoading(false)
    }
  }, [])

  const loadCampaigns = useCallback(async () => {
    setCampaignsLoading(true)
    try {
      const res = await fetch('/api/admin/campaigns')
      if (!res.ok) throw new Error('Failed to load campaigns')
      const data = await res.json()
      setCampaigns((data.campaigns ?? []) as Campaign[])
    } catch (err) {
      console.error('[campaigns] load error', err)
    } finally {
      setCampaignsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCoupons()
    void loadCampaigns()
  }, [loadCoupons, loadCampaigns])

  // ── Coupon actions ────────────────────────────────────────────
  async function createCoupon() {
    setCouponError(null)
    if (!couponForm.name.trim() || !couponForm.discountValue || !couponForm.validUntil) {
      setCouponError('Name, discount value, and valid-until date are required')
      return
    }
    const body: Record<string, unknown> = {
      name: couponForm.name.trim(),
      discountType: couponForm.discountType,
      discountValue: parseFloat(couponForm.discountValue),
      maxUses: couponForm.maxUses ? parseInt(couponForm.maxUses, 10) : null,
      validUntil: new Date(couponForm.validUntil).toISOString(),
    }
    const res = await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setCouponError((data?.error as string) ?? 'Failed to create coupon')
      return
    }
    setShowCouponForm(false)
    setCouponForm(EMPTY_COUPON_FORM)
    void loadCoupons()
  }

  async function toggleCoupon(id: string, current: boolean) {
    const res = await fetch(`/api/admin/coupons/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !current }),
    })
    if (res.ok) void loadCoupons()
  }

  async function deactivateCoupon(id: string) {
    if (!confirm('Deactivate this coupon template? Existing issued coupons remain valid.')) return
    const res = await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE' })
    if (res.ok) void loadCoupons()
  }

  // ── Campaign actions ──────────────────────────────────────────
  async function createCampaign() {
    setCampaignError(null)
    if (!campaignForm.name.trim() || !campaignForm.endsAt) {
      setCampaignError('Name and end date are required')
      return
    }
    const body: Record<string, unknown> = {
      name: campaignForm.name.trim(),
      description: campaignForm.description.trim(),
      startsAt: campaignForm.startsAt ? new Date(campaignForm.startsAt).toISOString() : new Date().toISOString(),
      endsAt: new Date(campaignForm.endsAt).toISOString(),
      status: campaignForm.status,
    }
    const res = await fetch('/api/admin/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setCampaignError((data?.error as string) ?? 'Failed to create campaign')
      return
    }
    setShowCampaignForm(false)
    setCampaignForm(EMPTY_CAMPAIGN_FORM)
    void loadCampaigns()
  }

  async function transitionCampaign(id: string, nextStatus: string) {
    const res = await fetch(`/api/admin/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      alert((data?.error as string) ?? 'Failed to update campaign')
      return
    }
    void loadCampaigns()
  }

  async function endCampaign(id: string) {
    if (!confirm('End this campaign? Claim tracking stops immediately.')) return
    const res = await fetch(`/api/admin/campaigns/${id}`, { method: 'DELETE' })
    if (res.ok) void loadCampaigns()
  }

  // ── Render helpers ────────────────────────────────────────────
  const statusStyle: Record<string, { color: string; dim: string; label: string }> = {
    active: { color: 'var(--admin-brand)', dim: 'var(--admin-brand-dim)', label: 'Active' },
    draft: { color: 'var(--admin-warning)', dim: 'var(--admin-warning-dim)', label: 'Draft' },
    ended: { color: 'var(--admin-text-faint)', dim: 'var(--admin-depth-2)', label: 'Ended' },
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Tab switch ─────────────────────────────────────────── */}
      <div
        className="flex w-fit items-center gap-1 rounded-full p-1"
        style={{ background: 'var(--admin-surface-elevated)', border: '1px solid var(--admin-border)' }}
      >
        <button
          type="button"
          onClick={() => setTab('coupons')}
          className="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
          style={{
            background: tab === 'coupons' ? 'var(--admin-brand)' : 'transparent',
            color: tab === 'coupons' ? 'var(--admin-brand-text)' : 'var(--admin-text-muted)',
          }}
        >
          <Ticket size={15} />
          Coupons
        </button>
        <button
          type="button"
          onClick={() => setTab('campaigns')}
          className="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
          style={{
            background: tab === 'campaigns' ? 'var(--admin-brand)' : 'transparent',
            color: tab === 'campaigns' ? 'var(--admin-brand-text)' : 'var(--admin-text-muted)',
          }}
        >
          <Megaphone size={15} />
          Campaigns
        </button>
      </div>

      {/* ══════════ COUPONS TAB ══════════ */}
      {tab === 'coupons' && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold" style={{ color: 'var(--admin-text)' }}>
              Coupon Templates
            </h2>
            <button
              type="button"
              onClick={() => setShowCouponForm((v) => !v)}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
              style={{
                background: 'var(--admin-brand)',
                color: 'var(--admin-brand-text)',
              }}
            >
              {showCouponForm ? <X size={16} /> : <Plus size={16} />}
              {showCouponForm ? 'Cancel' : 'New Coupon'}
            </button>
          </div>

          {showCouponForm && (
            <div
              className="flex flex-col gap-4 rounded-2xl p-5"
              style={{
                background: 'var(--admin-surface-elevated)',
                border: '1px solid var(--admin-border)',
              }}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Name">
                  <input
                    className={inputCls}
                    value={couponForm.name}
                    onChange={(e) => setCouponForm({ ...couponForm, name: e.target.value })}
                    placeholder="e.g. Summer Saver 20%"
                  />
                </Field>
                <Field label="Type">
                  <select
                    className={inputCls}
                    value={couponForm.discountType}
                    onChange={(e) =>
                      setCouponForm({ ...couponForm, discountType: e.target.value as 'percentage' | 'fixed' })
                    }
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (HK$)</option>
                  </select>
                </Field>
                <Field label={couponForm.discountType === 'percentage' ? 'Value (%)' : 'Value (HK$)'}>
                  <input
                    className={inputCls}
                    type="number"
                    min="0"
                    step="0.01"
                    value={couponForm.discountValue}
                    onChange={(e) => setCouponForm({ ...couponForm, discountValue: e.target.value })}
                    placeholder={couponForm.discountType === 'percentage' ? 'e.g. 20' : 'e.g. 50'}
                  />
                </Field>
                <Field label="Max Uses (optional)">
                  <input
                    className={inputCls}
                    type="number"
                    min="1"
                    value={couponForm.maxUses}
                    onChange={(e) => setCouponForm({ ...couponForm, maxUses: e.target.value })}
                    placeholder="Unlimited"
                  />
                </Field>
                <Field label="Valid Until">
                  <input
                    className={inputCls}
                    type="date"
                    value={couponForm.validUntil}
                    onChange={(e) => setCouponForm({ ...couponForm, validUntil: e.target.value })}
                  />
                </Field>
              </div>
              {couponError && (
                <p className="text-sm" style={{ color: 'var(--admin-danger)' }}>
                  {couponError}
                </p>
              )}
              <div>
                <button
                  type="button"
                  onClick={createCoupon}
                  className="rounded-xl px-4 py-2 text-sm font-semibold"
                  style={{ background: 'var(--admin-brand)', color: 'var(--admin-brand-text)' }}
                >
                  Create Coupon
                </button>
              </div>
            </div>
          )}

          {couponsLoading ? (
            <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>
              Loading…
            </p>
          ) : coupons.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>
              No coupon templates yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {coupons.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col gap-3 rounded-2xl p-4"
                  style={{
                    background: 'var(--admin-surface)',
                    border: '1px solid var(--admin-border)',
                  }}
                >
                  <CouponTicket
                    data={
                      {
                        name: c.name,
                        discountType: c.discountType,
                        discountValue: c.discountValue,
                        validUntil: c.validUntil,
                      } as CouponTicketData
                    }
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
                      {c.usedCount} used
                      {c.maxUses ? ` / ${c.maxUses}` : ''}
                      {c.issuedCount > 0 ? ` · ${c.issuedCount} issued` : ''}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggleCoupon(c.id, c.isActive)}
                        className="rounded-lg p-1.5 transition-colors"
                        style={{
                          color: c.isActive ? 'var(--admin-brand)' : 'var(--admin-text-faint)',
                          border: '1px solid var(--admin-border)',
                        }}
                        title={c.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {c.isActive ? <Check size={15} /> : <Ban size={15} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => deactivateCoupon(c.id)}
                        className="rounded-lg p-1.5 transition-colors"
                        style={{ color: 'var(--admin-danger)', border: '1px solid var(--admin-border)' }}
                        title="Deactivate template"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ══════════ CAMPAIGNS TAB ══════════ */}
      {tab === 'campaigns' && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold" style={{ color: 'var(--admin-text)' }}>
              Campaigns
            </h2>
            <button
              type="button"
              onClick={() => setShowCampaignForm((v) => !v)}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
              style={{ background: 'var(--admin-brand)', color: 'var(--admin-brand-text)' }}
            >
              {showCampaignForm ? <X size={16} /> : <Plus size={16} />}
              {showCampaignForm ? 'Cancel' : 'New Campaign'}
            </button>
          </div>

          {showCampaignForm && (
            <div
              className="flex flex-col gap-4 rounded-2xl p-5"
              style={{
                background: 'var(--admin-surface-elevated)',
                border: '1px solid var(--admin-border)',
              }}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Name">
                  <input
                    className={inputCls}
                    value={campaignForm.name}
                    onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                    placeholder="e.g. Referral Week"
                  />
                </Field>
                <Field label="Status">
                  <select
                    className={inputCls}
                    value={campaignForm.status}
                    onChange={(e) => setCampaignForm({ ...campaignForm, status: e.target.value })}
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                  </select>
                </Field>
                <Field label="Starts At">
                  <input
                    className={inputCls}
                    type="date"
                    value={campaignForm.startsAt}
                    onChange={(e) => setCampaignForm({ ...campaignForm, startsAt: e.target.value })}
                  />
                </Field>
                <Field label="Ends At">
                  <input
                    className={inputCls}
                    type="date"
                    value={campaignForm.endsAt}
                    onChange={(e) => setCampaignForm({ ...campaignForm, endsAt: e.target.value })}
                  />
                </Field>
                <Field label="Description" full>
                  <textarea
                    className={`${inputCls} min-h-[70px] resize-y`}
                    value={campaignForm.description}
                    onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })}
                    placeholder="Optional description"
                  />
                </Field>
              </div>
              {campaignError && (
                <p className="text-sm" style={{ color: 'var(--admin-danger)' }}>
                  {campaignError}
                </p>
              )}
              <div>
                <button
                  type="button"
                  onClick={createCampaign}
                  className="rounded-xl px-4 py-2 text-sm font-semibold"
                  style={{ background: 'var(--admin-brand)', color: 'var(--admin-brand-text)' }}
                >
                  Create Campaign
                </button>
              </div>
            </div>
          )}

          {campaignsLoading ? (
            <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>
              Loading…
            </p>
          ) : campaigns.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>
              No campaigns yet.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {campaigns.map((cm) => {
                const s = statusStyle[cm.status] ?? statusStyle.draft
                const endsAt = cm.endsAt ? new Date(cm.endsAt).toLocaleDateString('en-HK') : '—'
                return (
                  <div
                    key={cm.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4"
                    style={{
                      background: 'var(--admin-surface)',
                      border: '1px solid var(--admin-border)',
                    }}
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold" style={{ color: 'var(--admin-text)' }}>
                          {cm.name}
                        </span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                          style={{ background: s.dim, color: s.color }}
                        >
                          {s.label}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
                        Ends {endsAt} · {cm.claimCount} claims
                        {cm.description ? ` · ${cm.description}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {cm.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => transitionCampaign(cm.id, 'active')}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                          style={{ background: 'var(--admin-brand)', color: 'var(--admin-brand-text)' }}
                        >
                          Activate
                        </button>
                      )}
                      {cm.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => endCampaign(cm.id)}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                          style={{ background: 'var(--admin-danger)', color: 'var(--admin-brand-text)' }}
                        >
                          End
                        </button>
                      )}
                      {cm.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => endCampaign(cm.id)}
                          className="rounded-lg p-1.5"
                          style={{ color: 'var(--admin-danger)', border: '1px solid var(--admin-border)' }}
                          title="Delete draft"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

/* ── Shared form input style ──────────────────────────────────── */
const inputCls = [
  'w-full rounded-xl px-3.5 py-2.5 text-sm outline-none transition-colors',
  'placeholder:text-[var(--admin-text-faint)]',
].join(' ')

/* ── Labeled field wrapper ────────────────────────────────────── */
function Field({
  label,
  children,
  full,
}: {
  label: string
  children: React.ReactNode
  full?: boolean
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${full ? 'sm:col-span-2' : ''}`}>
      <span className="text-xs font-medium" style={{ color: 'var(--admin-text-muted)' }}>
        {label}
      </span>
      {children}
    </label>
  )
}
