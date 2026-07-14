'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Sheet } from '@/components/ui/Sheet'
import { tokens } from '@/app/styles/tokens'
import type { PricingPeriod, ServiceFees, Tier } from '@/lib/data/pricing'

type SiteValue = { currency: string; maxHours: number; openHour: number; closeHour: number }
type PricingValue = { periods: PricingPeriod[]; services: ServiceFees }
type BookingRulesValue = { refundCutoffHours: number }
type ConfigKey = 'site' | 'pricing' | 'tiers' | 'booking_rules'
type DiffRow = { label: string; before: string; after: string }
type ToastState = { type: 'success' | 'error'; message: string }

const SERVICE_LABELS: Record<keyof ServiceFees, string> = {
  locker_single: 'Locker (single use)',
  locker_monthly: 'Locker (monthly)',
  cue_pro_per_hour: 'Pro cue (per hour)',
  overtime_per_15min: 'Overtime (per 15 min)',
  drinks_min: 'Drinks (min)',
  drinks_max: 'Drinks (max)',
}

function sectionTitleStyle(): React.CSSProperties {
  return { fontSize: 18, fontWeight: 700, color: tokens.colors.text, marginBottom: tokens.spacing.md }
}

function fieldRowStyle(): React.CSSProperties {
  return { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: tokens.spacing.md }
}

// Shared confirm-modal + save-button chrome for every settings section.
function SectionShell({
  title,
  dirty,
  onRequestSave,
  children,
}: {
  title: string
  dirty: boolean
  onRequestSave: () => void
  children: React.ReactNode
}) {
  return (
    <Card style={{ marginBottom: tokens.spacing.lg }}>
      <div style={sectionTitleStyle()}>{title}</div>
      {children}
      <div style={{ marginTop: tokens.spacing.lg, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="primary" size="sm" disabled={!dirty} onClick={onRequestSave}>
          Save
        </Button>
      </div>
    </Card>
  )
}

function ConfirmModal({
  open,
  rows,
  saving,
  onCancel,
  onConfirm,
}: {
  open: boolean
  rows: DiffRow[]
  saving: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Sheet open={open} onClose={onCancel}>
      <div style={{ fontSize: 18, fontWeight: 700, color: tokens.colors.text, marginBottom: tokens.spacing.base }}>
        Confirm changes
      </div>
      <div style={{ marginBottom: tokens.spacing.lg }}>
        {rows.length === 0 ? (
          <div style={{ color: tokens.colors.textMuted, fontSize: 14 }}>No changes.</div>
        ) : (
          rows.map((row) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: tokens.spacing.sm,
                padding: `${tokens.spacing.sm} 0`,
                borderBottom: `1px solid ${tokens.colors.border}`,
                fontSize: 14,
              }}
            >
              <span style={{ color: tokens.colors.textMuted }}>{row.label}</span>
              <span style={{ color: tokens.colors.text }}>
                {row.before} <span style={{ color: tokens.colors.textFaint }}>&rarr;</span> {row.after}
              </span>
            </div>
          ))
        )}
      </div>
      <div style={{ display: 'flex', gap: tokens.spacing.sm, justifyContent: 'flex-end' }}>
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={onConfirm} loading={saving} disabled={rows.length === 0}>
          Apply now
        </Button>
      </div>
    </Sheet>
  )
}

function SiteSection({ initial, onSave }: { initial: SiteValue; onSave: (v: SiteValue) => Promise<boolean> }) {
  const [value, setValue] = useState(initial)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(value) !== JSON.stringify(initial)

  const rows: DiffRow[] = []
  if (value.currency !== initial.currency) rows.push({ label: 'Currency', before: initial.currency, after: value.currency })
  if (value.maxHours !== initial.maxHours) rows.push({ label: 'Max hours', before: String(initial.maxHours), after: String(value.maxHours) })
  if (value.openHour !== initial.openHour) rows.push({ label: 'Open hour', before: String(initial.openHour), after: String(value.openHour) })
  if (value.closeHour !== initial.closeHour) rows.push({ label: 'Close hour', before: String(initial.closeHour), after: String(value.closeHour) })

  return (
    <>
      <SectionShell title="Venue" dirty={dirty} onRequestSave={() => setConfirmOpen(true)}>
        <div style={fieldRowStyle()}>
          <Input label="Currency" value={value.currency} onChange={(e) => setValue((v) => ({ ...v, currency: e.target.value }))} />
          <Input label="Max hours" type="number" min={1} inputMode="numeric" value={value.maxHours} onChange={(e) => setValue((v) => ({ ...v, maxHours: Number(e.target.value) || 0 }))} />
          <Input label="Open hour" type="number" min={0} max={24} inputMode="numeric" value={value.openHour} onChange={(e) => setValue((v) => ({ ...v, openHour: Number(e.target.value) || 0 }))} />
          <Input label="Close hour" type="number" min={0} max={24} inputMode="numeric" value={value.closeHour} onChange={(e) => setValue((v) => ({ ...v, closeHour: Number(e.target.value) || 0 }))} />
        </div>
      </SectionShell>
      <ConfirmModal
        open={confirmOpen}
        rows={rows}
        saving={saving}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          setSaving(true)
          const ok = await onSave(value)
          setSaving(false)
          setConfirmOpen(false)
          if (!ok) setValue(initial)
        }}
      />
    </>
  )
}

function PricingSection({ initial, onSave }: { initial: PricingValue; onSave: (v: PricingValue) => Promise<boolean> }) {
  const [value, setValue] = useState(initial)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(value) !== JSON.stringify(initial)

  function setPeriod(id: PricingPeriod['id'], patch: Partial<PricingPeriod>) {
    setValue((v) => ({ ...v, periods: v.periods.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
  }
  function setService(key: keyof ServiceFees, num: number) {
    setValue((v) => ({ ...v, services: { ...v.services, [key]: num } }))
  }

  const rows: DiffRow[] = []
  value.periods.forEach((p) => {
    const before = initial.periods.find((ip) => ip.id === p.id)
    if (!before) return
    if (p.rate !== before.rate) rows.push({ label: `${p.id} rate`, before: `${before.rate}`, after: `${p.rate}` })
    if (p.rateFrom2h !== before.rateFrom2h) rows.push({ label: `${p.id} rate (2h+)`, before: `${before.rateFrom2h ?? '—'}`, after: `${p.rateFrom2h ?? '—'}` })
    if (p.start !== before.start) rows.push({ label: `${p.id} start`, before: before.start, after: p.start })
    if (p.end !== before.end) rows.push({ label: `${p.id} end`, before: before.end, after: p.end })
  })
  SERVICE_KEYS_FOR_DIFF.forEach((key) => {
    if (value.services[key] !== initial.services[key]) {
      rows.push({ label: SERVICE_LABELS[key], before: `${initial.services[key]}`, after: `${value.services[key]}` })
    }
  })

  return (
    <>
      <SectionShell title="Pricing" dirty={dirty} onRequestSave={() => setConfirmOpen(true)}>
        {value.periods.map((p) => (
          <div key={p.id} style={{ marginBottom: tokens.spacing.base }}>
            <div style={{ fontSize: 13, color: tokens.colors.textMuted, marginBottom: tokens.spacing.xs, textTransform: 'capitalize' }}>
              {p.id} ({p.days})
            </div>
            <div style={fieldRowStyle()}>
              <Input label="Rate (HK$/hr)" type="number" min={0} inputMode="numeric" value={p.rate} onChange={(e) => setPeriod(p.id, { rate: Number(e.target.value) || 0 })} />
              <Input
                label="Rate 2h+ (blank = none)"
                type="number"
                min={0}
                inputMode="numeric"
                value={p.rateFrom2h ?? ''}
                onChange={(e) => setPeriod(p.id, { rateFrom2h: e.target.value === '' ? undefined : Number(e.target.value) || 0 })}
              />
              <Input label="Start" value={p.start} onChange={(e) => setPeriod(p.id, { start: e.target.value })} />
              <Input label="End" value={p.end} onChange={(e) => setPeriod(p.id, { end: e.target.value })} />
            </div>
          </div>
        ))}
        <div style={{ fontSize: 13, color: tokens.colors.textMuted, margin: `${tokens.spacing.base} 0 ${tokens.spacing.xs}` }}>
          Service fees
        </div>
        <div style={fieldRowStyle()}>
          {SERVICE_KEYS_FOR_DIFF.map((key) => (
            <Input
              key={key}
              label={SERVICE_LABELS[key]}
              type="number"
              min={0}
              inputMode="numeric"
              value={value.services[key]}
              onChange={(e) => setService(key, Number(e.target.value) || 0)}
            />
          ))}
        </div>
      </SectionShell>
      <ConfirmModal
        open={confirmOpen}
        rows={rows}
        saving={saving}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          setSaving(true)
          const ok = await onSave(value)
          setSaving(false)
          setConfirmOpen(false)
          if (!ok) setValue(initial)
        }}
      />
    </>
  )
}

const SERVICE_KEYS_FOR_DIFF: (keyof ServiceFees)[] = [
  'locker_single',
  'locker_monthly',
  'cue_pro_per_hour',
  'overtime_per_15min',
  'drinks_min',
  'drinks_max',
]

function TiersSection({ initial, onSave }: { initial: Tier[]; onSave: (v: Tier[]) => Promise<boolean> }) {
  const [value, setValue] = useState(initial)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(value) !== JSON.stringify(initial)

  function setTier(id: Tier['id'], patch: Partial<Tier>) {
    setValue((v) => v.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }

  const rows: DiffRow[] = []
  value.forEach((t) => {
    const before = initial.find((it) => it.id === t.id)
    if (!before) return
    if (t.minPts !== before.minPts) rows.push({ label: `${t.id} min points`, before: `${before.minPts}`, after: `${t.minPts}` })
    if (t.discount !== before.discount) rows.push({ label: `${t.id} discount`, before: `${before.discount}`, after: `${t.discount}` })
    if (t.multiplier !== before.multiplier) rows.push({ label: `${t.id} multiplier`, before: `${before.multiplier}`, after: `${t.multiplier}` })
  })

  return (
    <>
      <SectionShell title="Tiers" dirty={dirty} onRequestSave={() => setConfirmOpen(true)}>
        {value.map((t) => (
          <div key={t.id} style={{ marginBottom: tokens.spacing.base }}>
            <div style={{ fontSize: 13, color: tokens.colors.textMuted, marginBottom: tokens.spacing.xs, textTransform: 'capitalize' }}>
              {t.id}
            </div>
            <div style={fieldRowStyle()}>
              <Input label="Min points" type="number" min={0} inputMode="numeric" value={t.minPts} onChange={(e) => setTier(t.id, { minPts: Number(e.target.value) || 0 })} />
              <Input label="Discount (0-1)" type="number" min={0} max={1} step={0.01} inputMode="decimal" value={t.discount} onChange={(e) => setTier(t.id, { discount: Number(e.target.value) || 0 })} />
              <Input label="Points multiplier" type="number" min={0} step={0.1} inputMode="decimal" value={t.multiplier} onChange={(e) => setTier(t.id, { multiplier: Number(e.target.value) || 0 })} />
            </div>
          </div>
        ))}
      </SectionShell>
      <ConfirmModal
        open={confirmOpen}
        rows={rows}
        saving={saving}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          setSaving(true)
          const ok = await onSave(value)
          setSaving(false)
          setConfirmOpen(false)
          if (!ok) setValue(initial)
        }}
      />
    </>
  )
}

function BookingRulesSection({
  initial,
  onSave,
}: {
  initial: BookingRulesValue
  onSave: (v: BookingRulesValue) => Promise<boolean>
}) {
  const [value, setValue] = useState(initial)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(value) !== JSON.stringify(initial)

  const rows: DiffRow[] =
    value.refundCutoffHours !== initial.refundCutoffHours
      ? [{ label: 'Refund cutoff (hours before start)', before: `${initial.refundCutoffHours}`, after: `${value.refundCutoffHours}` }]
      : []

  return (
    <>
      <SectionShell title="Booking rules" dirty={dirty} onRequestSave={() => setConfirmOpen(true)}>
        <div style={fieldRowStyle()}>
          <Input
            label="Refund cutoff (hours before start)"
            type="number"
            min={0}
            inputMode="numeric"
            value={value.refundCutoffHours}
            onChange={(e) => setValue({ refundCutoffHours: Number(e.target.value) || 0 })}
          />
        </div>
      </SectionShell>
      <ConfirmModal
        open={confirmOpen}
        rows={rows}
        saving={saving}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          setSaving(true)
          const ok = await onSave(value)
          setSaving(false)
          setConfirmOpen(false)
          if (!ok) setValue(initial)
        }}
      />
    </>
  )
}

export default function SettingsForm({
  site,
  pricing,
  tiers,
  bookingRules,
}: {
  site: SiteValue
  pricing: PricingValue
  tiers: Tier[]
  bookingRules: BookingRulesValue
}) {
  const [toast, setToast] = useState<ToastState | null>(null)

  async function saveConfig(key: ConfigKey, value: unknown): Promise<boolean> {
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      })
      const json: unknown = await res.json().catch(() => null)
      const errorMessage =
        json && typeof json === 'object' && 'error' in json && typeof (json as { error: unknown }).error === 'string'
          ? (json as { error: string }).error
          : 'Save failed'
      if (!res.ok) {
        setToast({ type: 'error', message: errorMessage })
        return false
      }
      setToast({ type: 'success', message: 'Saved' })
      return true
    } catch {
      setToast({ type: 'error', message: 'Network error' })
      return false
    } finally {
      setTimeout(() => setToast(null), 2000)
    }
  }

  return (
    <div>
      <SiteSection initial={site} onSave={(v) => saveConfig('site', v)} />
      <PricingSection initial={pricing} onSave={(v) => saveConfig('pricing', v)} />
      <TiersSection initial={tiers} onSave={(v) => saveConfig('tiers', v)} />
      <BookingRulesSection initial={bookingRules} onSave={(v) => saveConfig('booking_rules', v)} />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              top: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              background: tokens.colors.surfaceElevated,
              border: `1px solid ${toast.type === 'error' ? tokens.colors.danger : tokens.colors.borderStrong}`,
              borderRadius: tokens.radius.button,
              padding: '12px 20px',
              fontSize: 14,
              color: tokens.colors.text,
              zIndex: 1000,
            }}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
