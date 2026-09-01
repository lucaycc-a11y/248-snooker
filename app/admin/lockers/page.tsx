'use client'

/**
 * Admin Locker Management — §11.6.
 *
 * CRUD for lockers table (number, status, label).
 * Locker bookings view with status filters.
 * Design system: admin-theme.css variables only. NO inline hex, NO shadows, NO `any`.
 */

import { useState, useCallback, useEffect } from 'react'

/* ── Types ────────────────────────────────────────────── */
type LockerStatus = 'available' | 'occupied' | 'maintenance'
type BookingStatus = 'active' | 'expired' | 'cancelled'

type Locker = {
  id: string
  number: number
  status: LockerStatus
  label: string | null
}

type LockerBooking = {
  id: string
  lockerId: string
  userId: string
  bookingId: string | null
  startTime: string
  endTime: string
  status: BookingStatus
  createdAt: string
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/* ── Status config ────────────────────────────────────── */
const STATUS_CONFIG: Record<LockerStatus, { label: string; bg: string; text: string }> = {
  available: { label: 'Available', bg: 'var(--admin-brand-dim)', text: 'var(--admin-brand)' },
  occupied: { label: 'Occupied', bg: 'var(--admin-warning-dim)', text: 'var(--admin-warning)' },
  maintenance: { label: 'Maintenance', bg: 'var(--admin-danger-dim)', text: 'var(--admin-danger)' },
}

const BOOKING_STATUS_CONFIG: Record<BookingStatus, { label: string; bg: string; text: string }> = {
  active: { label: 'Active', bg: 'var(--admin-brand-dim)', text: 'var(--admin-brand)' },
  expired: { label: 'Expired', bg: 'var(--admin-surface-alt, var(--admin-surface))', text: 'var(--admin-text-muted)' },
  cancelled: { label: 'Cancelled', bg: 'var(--admin-danger-dim)', text: 'var(--admin-danger)' },
}

/* ── Helper ───────────────────────────────────────────── */
function Badge({ config }: { config: { label: string; bg: string; text: string } }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{ background: config.bg, color: config.text }}
    >
      {config.label}
    </span>
  )
}

/* ── Component ──────────────────────────────────────── */
export default function LockersPage() {
  const [lockers, setLockers] = useState<Locker[]>([])
  const [bookings, setBookings] = useState<LockerBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | LockerStatus>('all')
  const [bookingFilter, setBookingFilter] = useState<'active' | 'all'>('active')

  // Modal state
  const [showForm, setShowForm] = useState(false)
  const [editingLocker, setEditingLocker] = useState<Locker | null>(null)
  const [formNumber, setFormNumber] = useState('')
  const [formStatus, setFormStatus] = useState<LockerStatus>('available')
  const [formLabel, setFormLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/lockers')
      if (!res.ok) throw new Error('Failed to fetch')
      const json: unknown = await res.json()
      if (isRecord(json)) {
        const lockerRows = Array.isArray(json.lockers) ? json.lockers : []
        setLockers(
          lockerRows.map((r: unknown) => {
            const row = r as Record<string, unknown>
            return {
              id: row.id as string,
              number: typeof row.number === 'number' ? row.number : 0,
              status: (row.status as LockerStatus) ?? 'available',
              label: (row.label as string) ?? null,
            }
          })
        )
        const bookingRows = Array.isArray(json.bookings) ? json.bookings : []
        setBookings(
          bookingRows.map((r: unknown) => {
            const row = r as Record<string, unknown>
            return {
              id: row.id as string,
              lockerId: row.lockerId as string,
              userId: row.userId as string,
              bookingId: (row.bookingId as string) ?? null,
              startTime: (row.startTime as string) ?? '',
              endTime: (row.endTime as string) ?? '',
              status: (row.status as BookingStatus) ?? 'active',
              createdAt: (row.createdAt as string) ?? '',
            }
          })
        )
      }
    } catch (err) {
      console.error('[lockers] fetch error', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const openCreate = useCallback(() => {
    setEditingLocker(null)
    setFormNumber('')
    setFormStatus('available')
    setFormLabel('')
    setError(null)
    setShowForm(true)
  }, [])

  const openEdit = useCallback((locker: Locker) => {
    setEditingLocker(locker)
    setFormNumber(String(locker.number))
    setFormStatus(locker.status)
    setFormLabel(locker.label ?? '')
    setError(null)
    setShowForm(true)
  }, [])

  const handleSave = useCallback(async () => {
    const numVal = parseInt(formNumber, 10)
    if (isNaN(numVal) || numVal < 1) {
      setError('Please enter a valid locker number (≥ 1)')
      return
    }

    setSaving(true)
    setError(null)

    try {
      if (editingLocker) {
        // Update
        const res = await fetch('/api/admin/lockers', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingLocker.id,
            number: numVal,
            status: formStatus,
            label: formLabel.trim() || null,
          }),
        })
        const json: unknown = await res.json()
        if (!res.ok) {
          const msg = isRecord(json) && typeof json.error === 'string' ? json.error : 'Failed to update'
          setError(msg)
          return
        }
      } else {
        // Create
        const res = await fetch('/api/admin/lockers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            number: numVal,
            status: formStatus,
            label: formLabel.trim() || null,
          }),
        })
        const json: unknown = await res.json()
        if (!res.ok) {
          const msg = isRecord(json) && typeof json.error === 'string' ? json.error : 'Failed to create'
          setError(msg)
          return
        }
      }

      setShowForm(false)
      await fetchData()
    } catch (err) {
      console.error('[lockers] save error', err)
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }, [editingLocker, formNumber, formStatus, formLabel, fetchData])

  const handleDelete = useCallback(async (locker: Locker) => {
    if (!confirm(`Delete locker #${locker.number}? This cannot be undone.`)) return

    try {
      const res = await fetch(`/api/admin/lockers?id=${locker.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json: unknown = await res.json()
        const msg = isRecord(json) && typeof json.error === 'string' ? json.error : 'Failed to delete'
        alert(msg)
        return
      }
      await fetchData()
    } catch (err) {
      console.error('[lockers] delete error', err)
    }
  }, [fetchData])

  // Filtered lockers
  const filteredLockers = filter === 'all' ? lockers : lockers.filter((l) => l.status === filter)
  const filteredBookings = bookingFilter === 'active'
    ? bookings
    : bookings // 'all' — though API currently only returns active

  // Stats
  const totalLockers = lockers.length
  const availableCount = lockers.filter((l) => l.status === 'available').length
  const occupiedCount = lockers.filter((l) => l.status === 'occupied').length
  const maintenanceCount = lockers.filter((l) => l.status === 'maintenance').length

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 md:px-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1
          className="text-2xl font-bold"
          style={{ color: 'var(--admin-text)' }}
          data-cms-key="admin_lockers_title"
        >
          Locker Management
        </h1>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-colors"
          style={{ color: 'var(--admin-brand-text)', background: 'var(--admin-brand)' }}
          data-cms-key="admin_lockers_add_btn"
        >
          + Add Locker
        </button>
      </header>

      {/* ── Stats Row ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total', value: totalLockers, bg: 'var(--admin-surface)', border: 'var(--admin-border)' },
          { label: 'Available', value: availableCount, bg: 'var(--admin-brand-dim)', border: 'var(--admin-brand)' },
          { label: 'Occupied', value: occupiedCount, bg: 'var(--admin-warning-dim)', border: 'var(--admin-warning)' },
          { label: 'Maintenance', value: maintenanceCount, bg: 'var(--admin-danger-dim)', border: 'var(--admin-danger)' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col gap-1 rounded-xl p-4"
            style={{ background: stat.bg, border: `1px solid ${stat.border}` }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
              {stat.label}
            </span>
            <span className="text-xl font-bold" style={{ color: 'var(--admin-text)' }}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* ── Filters ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
          Locker status:
        </span>
        {(['all', 'available', 'occupied', 'maintenance'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors"
            style={{
              background: filter === f ? 'var(--admin-brand)' : 'var(--admin-surface)',
              color: filter === f ? 'var(--admin-brand-text)' : 'var(--admin-text-muted)',
              border: `1px solid ${filter === f ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
            }}
          >
            {f}
          </button>
        ))}

        <span className="ml-4 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
          Bookings:
        </span>
        {(['active', 'all'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setBookingFilter(f)}
            className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors"
            style={{
              background: bookingFilter === f ? 'var(--admin-brand)' : 'var(--admin-surface)',
              color: bookingFilter === f ? 'var(--admin-brand-text)' : 'var(--admin-text-muted)',
              border: `1px solid ${bookingFilter === f ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* ── Locker Grid ─────────────────────────────────────── */}
      {loading && lockers.length === 0 ? (
        <div className="flex items-center justify-center py-16" style={{ color: 'var(--admin-text-muted)' }}>
          <span className="admin-conic-spinner mr-2" />
          Loading lockers…
        </div>
      ) : filteredLockers.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-2xl py-16"
          style={{ background: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}
        >
          <span className="text-3xl">🔒</span>
          <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>
            {filter === 'all' ? 'No lockers yet. Click "Add Locker" to create one.' : `No ${filter} lockers.`}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredLockers.map((locker) => {
            const cfg = STATUS_CONFIG[locker.status]
            const activeBooking = bookings.find((b) => b.lockerId === locker.id && b.status === 'active')

            return (
              <div
                key={locker.id}
                className="flex flex-col gap-3 rounded-2xl p-4 transition-colors"
                style={{
                  background: 'var(--admin-surface)',
                  border: '1px solid var(--admin-border)',
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold"
                      style={{ background: 'var(--admin-bg)', color: 'var(--admin-text)' }}
                    >
                      {locker.number}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold" style={{ color: 'var(--admin-text)' }}>
                        Locker #{locker.number}
                      </span>
                      {locker.label && (
                        <span className="text-[10px]" style={{ color: 'var(--admin-text-muted)' }}>
                          {locker.label}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge config={cfg} />
                </div>

                {activeBooking && (
                  <div
                    className="rounded-lg p-2 text-[10px]"
                    style={{ background: 'var(--admin-bg)', color: 'var(--admin-text-muted)' }}
                  >
                    <div className="flex items-center justify-between">
                      <span>Active booking</span>
                      <Badge config={BOOKING_STATUS_CONFIG.active} />
                    </div>
                    <p className="mt-1">
                      {new Date(activeBooking.startTime).toLocaleDateString('en-HK', { month: 'short', day: 'numeric' })}
                      {' → '}
                      {new Date(activeBooking.endTime).toLocaleDateString('en-HK', { month: 'short', day: 'numeric' })}
                    </p>
                    <p className="mt-0.5 opacity-70">User: {activeBooking.userId.slice(0, 8)}…</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(locker)}
                    className="flex-1 rounded-lg px-3 py-1.5 text-[10px] font-semibold transition-colors"
                    style={{ background: 'var(--admin-bg)', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-border)' }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(locker)}
                    className="rounded-lg px-3 py-1.5 text-[10px] font-semibold transition-colors"
                    style={{ background: 'var(--admin-danger-dim)', color: 'var(--admin-danger)' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Create/Edit Modal ──────────────────────────────── */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowForm(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-sm font-bold" style={{ color: 'var(--admin-text)' }}>
              {editingLocker ? `Edit Locker #${editingLocker.number}` : 'Add Locker'}
            </h2>

            {error && (
              <div
                className="mb-4 rounded-lg px-3 py-2 text-xs"
                style={{ background: 'var(--admin-danger-dim)', color: 'var(--admin-danger)' }}
              >
                {error}
              </div>
            )}

            <div className="flex flex-col gap-4">
              {/* Number */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
                  Locker Number
                </label>
                <input
                  type="number"
                  min={1}
                  value={formNumber}
                  onChange={(e) => setFormNumber(e.target.value)}
                  placeholder="e.g. 1"
                  className="rounded-lg border px-3 py-2 text-xs outline-none transition-colors focus:border-[var(--admin-brand)]"
                  style={{ background: 'var(--admin-bg)', color: 'var(--admin-text)', borderColor: 'var(--admin-border)' }}
                />
              </div>

              {/* Status */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
                  Status
                </label>
                <div className="flex gap-2">
                  {(['available', 'occupied', 'maintenance'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFormStatus(s)}
                      className="flex-1 rounded-lg px-3 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors"
                      style={{
                        background: formStatus === s ? STATUS_CONFIG[s].bg : 'var(--admin-bg)',
                        color: formStatus === s ? STATUS_CONFIG[s].text : 'var(--admin-text-muted)',
                        border: `1px solid ${formStatus === s ? STATUS_CONFIG[s].text : 'var(--admin-border)'}`,
                      }}
                    >
                      {STATUS_CONFIG[s].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Label */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
                  Label (optional)
                </label>
                <input
                  type="text"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  placeholder="e.g. Near entrance"
                  className="rounded-lg border px-3 py-2 text-xs outline-none transition-colors focus:border-[var(--admin-brand)]"
                  style={{ background: 'var(--admin-bg)', color: 'var(--admin-text)', borderColor: 'var(--admin-border)' }}
                />
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-lg px-4 py-2 text-xs font-semibold transition-colors"
                style={{ background: 'var(--admin-bg)', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-border)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-colors"
                style={{
                  color: 'var(--admin-brand-text)',
                  background: 'var(--admin-brand)',
                  opacity: saving ? 0.5 : 1,
                }}
              >
                {saving && <span className="admin-conic-spinner h-3 w-3" />}
                {editingLocker ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
