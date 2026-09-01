'use client'

/**
 * ManualBookingWizard — §6.3 admin manual booking flow.
 *
 * 3-step wizard:
 *   1. Payment evidence (provider, reference, amount, notes)
 *   2. Slot selection & conflict check (reuse find_or_lock_slot RPC)
 *   3. Link to user (search by email/phone/name or leave unlinked)
 *
 * On submit: calls POST /api/admin/bookings/manual-create
 * All Tailwind + CSS variable tokens. Framer Motion for step transitions.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  CreditCard,
  CalendarDays,
  UserCheck,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertTriangle,
  X,
  Loader2,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3

interface PaymentEvidence {
  provider: string
  reference: string
  amount: number
  notes: string
}

interface SlotRequest {
  date: string
  startHour: number
  duration: number
  tableNumber: 1 | 2
}

interface SlotResult {
  available: boolean
  slotId?: string
  lockedUntil?: string
  error?: string
}

interface UserResult {
  id: string
  email: string | null
  phone: string | null
  displayName: string | null
}

interface WizardProps {
  onClose: () => void
  onCreated?: () => void
}

const PROVIDERS = [
  { value: 'fps', label: 'FPS' },
  { value: 'payme', label: 'PayMe' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'octopus', label: 'Octopus' },
  { value: 'other', label: 'Other' },
]

const DURATIONS = [1, 2, 3, 4, 5, 6]

// ── Helper functions ───────────────────────────────────────────────────────

function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

function formatEndHour(start: number, duration: number): string {
  return formatHour((start + duration) % 24)
}

// ── Step indicators ────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  const steps = [
    { num: 1 as Step, label: 'Payment', icon: CreditCard },
    { num: 2 as Step, label: 'Slot', icon: CalendarDays },
    { num: 3 as Step, label: 'User', icon: UserCheck },
  ]

  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
              step === s.num
                ? 'bg-[var(--admin-brand)] text-black'
                : step > s.num
                  ? 'bg-[var(--admin-brand)]/20 text-[var(--admin-brand)]'
                  : 'bg-[var(--admin-surface)] text-[var(--admin-text-muted)]'
            }`}
          >
            {step > s.num ? <Check size={14} /> : s.num}
          </div>
          <span
            className={`hidden text-xs sm:inline ${
              step === s.num ? 'text-[var(--admin-text)]' : 'text-[var(--admin-text-muted)]'
            }`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <div
              className={`ml-1 h-px w-6 ${
                step > s.num ? 'bg-[var(--admin-brand)]' : 'bg-[var(--admin-border)]'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Step 1: Payment Evidence ───────────────────────────────────────────────

function StepPayment({
  data,
  onChange,
}: {
  data: PaymentEvidence
  onChange: (d: PaymentEvidence) => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--admin-text-muted)]">
        Record payment details for manual verification.
      </p>

      {/* Provider */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--admin-text-muted)]">
          Payment Provider
        </label>
        <select
          value={data.provider}
          onChange={(e) => onChange({ ...data, provider: e.target.value })}
          className="w-full rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] px-3 py-2.5 text-sm text-[var(--admin-text)] outline-none focus:border-[var(--admin-brand)] transition-colors"
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Reference */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--admin-text-muted)]">
          Transaction Reference
        </label>
        <input
          type="text"
          value={data.reference}
          onChange={(e) => onChange({ ...data, reference: e.target.value })}
          placeholder="e.g. FPS-123456789, PayMe ref..."
          className="w-full rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] px-3 py-2.5 text-sm text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)] outline-none focus:border-[var(--admin-brand)] transition-colors"
        />
      </div>

      {/* Amount */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--admin-text-muted)]">
          Amount (HKD)
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--admin-text-muted)]">
            $
          </span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={data.amount || ''}
            onChange={(e) => onChange({ ...data, amount: parseFloat(e.target.value) || 0 })}
            placeholder="0.00"
            className="w-full rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] pl-7 pr-3 py-2.5 text-sm text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)] outline-none focus:border-[var(--admin-brand)] transition-colors font-mono tabular-nums"
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--admin-text-muted)]">
          Notes (optional)
        </label>
        <textarea
          value={data.notes}
          onChange={(e) => onChange({ ...data, notes: e.target.value })}
          placeholder="Any additional context..."
          rows={3}
          className="w-full rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] px-3 py-2.5 text-sm text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)] outline-none focus:border-[var(--admin-brand)] transition-colors resize-none"
        />
      </div>
    </div>
  )
}

// ── Step 2: Slot Selection ─────────────────────────────────────────────────

function StepSlot({
  data,
  onChange,
  slotResult,
  onCheckSlot,
  checking,
}: {
  data: SlotRequest
  onChange: (d: SlotRequest) => void
  slotResult: SlotResult | null
  onCheckSlot: () => void
  checking: boolean
}) {
  const dateRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    dateRef.current?.focus()
  }, [])

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--admin-text-muted)]">
        Select the date, time, duration, and table for this booking.
      </p>

      {/* Date */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--admin-text-muted)]">
          Date
        </label>
        <input
          ref={dateRef}
          type="date"
          value={data.date}
          onChange={(e) => onChange({ ...data, date: e.target.value })}
          className="w-full rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] px-3 py-2.5 text-sm text-[var(--admin-text)] outline-none focus:border-[var(--admin-brand)] transition-colors [color-scheme:dark]"
        />
      </div>

      {/* Start hour + Duration row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--admin-text-muted)]">
            Start Time
          </label>
          <select
            value={data.startHour}
            onChange={(e) => onChange({ ...data, startHour: parseInt(e.target.value) })}
            className="w-full rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] px-3 py-2.5 text-sm text-[var(--admin-text)] outline-none focus:border-[var(--admin-brand)] transition-colors"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {formatHour(i)} — {formatEndHour(i, data.duration)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--admin-text-muted)]">
            Duration
          </label>
          <select
            value={data.duration}
            onChange={(e) => onChange({ ...data, duration: parseInt(e.target.value) })}
            className="w-full rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] px-3 py-2.5 text-sm text-[var(--admin-text)] outline-none focus:border-[var(--admin-brand)] transition-colors"
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d} hour{d > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--admin-text-muted)]">
          Table
        </label>
        <div className="flex gap-2">
          {[1, 2].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange({ ...data, tableNumber: t as 1 | 2 })}
              className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                data.tableNumber === t
                  ? 'border-[var(--admin-brand)] bg-[var(--admin-brand)]/10 text-[var(--admin-brand)]'
                  : 'border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]'
              }`}
            >
              Table {t}
            </button>
          ))}
        </div>
      </div>

      {/* Check slot button */}
      <button
        type="button"
        onClick={onCheckSlot}
        disabled={checking || !data.date}
        className="w-full rounded-xl bg-[var(--admin-brand)] px-4 py-2.5 text-sm font-medium text-black hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {checking ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Checking slot...
          </>
        ) : (
          'Check Availability'
        )}
      </button>

      {/* Slot result */}
      {slotResult && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-xl border px-4 py-3 text-sm ${
            slotResult.available
              ? 'border-[var(--admin-brand)]/30 bg-[var(--admin-brand)]/10 text-[var(--admin-brand)]'
              : 'border-red-500/30 bg-red-500/10 text-red-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {slotResult.available ? (
              <Check size={16} />
            ) : (
              <AlertTriangle size={16} />
            )}
            <span>
              {slotResult.available
                ? `Slot available — locked until ${slotResult.lockedUntil ? new Date(slotResult.lockedUntil).toLocaleTimeString() : 'confirmed'}`
                : `Slot conflict: ${slotResult.error ?? 'unavailable'}`}
            </span>
          </div>
        </motion.div>
      )}
    </div>
  )
}

// ── Step 3: Link User ──────────────────────────────────────────────────────

function StepUser({
  selectedUser,
  onSelectUser,
  onClearUser,
  onSearch,
  searching,
  searchResults,
  searchQuery,
  onSearchQueryChange,
}: {
  selectedUser: UserResult | null
  onSelectUser: (u: UserResult) => void
  onClearUser: () => void
  onSearch: () => void
  searching: boolean
  searchResults: UserResult[]
  searchQuery: string
  onSearchQueryChange: (q: string) => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--admin-text-muted)]">
        Link this booking to a user, or leave unlinked for later assignment.
      </p>

      {/* Selected user display */}
      {selectedUser && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-xl border border-[var(--admin-brand)]/30 bg-[var(--admin-brand)]/10 px-4 py-3"
        >
          <div>
            <div className="text-sm font-medium text-[var(--admin-brand)]">
              {selectedUser.displayName ?? selectedUser.email ?? selectedUser.phone ?? 'User'}
            </div>
            <div className="text-xs text-[var(--admin-text-muted)]">
              {selectedUser.email}
              {selectedUser.phone ? ` · ${selectedUser.phone}` : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={onClearUser}
            className="rounded-lg p-1 text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] transition-colors"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}

      {/* Search input */}
      {!selectedUser && (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSearch()
                }}
                placeholder="Email, phone, or name..."
                className="w-full rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] pl-9 pr-3 py-2.5 text-sm text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)] outline-none focus:border-[var(--admin-brand)] transition-colors"
              />
            </div>
            <button
              type="button"
              onClick={onSearch}
              disabled={searching || !searchQuery}
              className="rounded-xl bg-[var(--admin-brand)] px-4 py-2.5 text-sm font-medium text-black hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {searching ? <Loader2 size={16} className="animate-spin" /> : 'Search'}
            </button>
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] divide-y divide-[var(--admin-border)] max-h-[200px] overflow-y-auto">
              {searchResults.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onSelectUser(u)}
                  className="w-full px-4 py-3 text-left hover:bg-[var(--admin-brand)]/[0.04] transition-colors"
                >
                  <div className="text-sm text-[var(--admin-text)]">
                    {u.displayName ?? u.email ?? u.phone ?? 'User'}
                  </div>
                  <div className="text-xs text-[var(--admin-text-muted)]">
                    {u.email}
                    {u.phone ? ` · ${u.phone}` : ''}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <p className="text-xs text-[var(--admin-text-muted)]">
        Leave unlinked to create a booking without a specific user assignment.
      </p>
    </div>
  )
}

// ── Main Wizard Component ──────────────────────────────────────────────────

export default function ManualBookingWizard({ onClose, onCreated }: WizardProps) {
  const [step, setStep] = useState<Step>(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1 — payment evidence
  const [payment, setPayment] = useState<PaymentEvidence>({
    provider: 'fps',
    reference: '',
    amount: 0,
    notes: '',
  })

  // Step 2 — slot selection
  const [slot, setSlot] = useState<SlotRequest>({
    date: '',
    startHour: 10,
    duration: 1,
    tableNumber: 1,
  })
  const [slotResult, setSlotResult] = useState<SlotResult | null>(null)
  const [checkingSlot, setCheckingSlot] = useState(false)

  // Step 3 — user link
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserResult[]>([])
  const [searching, setSearching] = useState(false)

  // ── Slot check ─────────────────────────────────────────────────────────
  const checkSlot = useCallback(async () => {
    if (!slot.date) return
    setCheckingSlot(true)
    setSlotResult(null)
    try {
      const res = await fetch('/api/admin/bookings/manual-slot-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slot),
      })
      const data = await res.json()
      setSlotResult(data)
    } catch {
      setSlotResult({ available: false, error: 'Failed to check slot' })
    } finally {
      setCheckingSlot(false)
    }
  }, [slot])

  // ── User search ────────────────────────────────────────────────────────
  const searchUsers = useCallback(async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const params = new URLSearchParams({ q: searchQuery.trim() })
      const res = await fetch(`/api/admin/bookings/manual-user-search?${params}`)
      const data = await res.json()
      setSearchResults(data.users ?? [])
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [searchQuery])

  // ── Submit (create booking) ────────────────────────────────────────────
  const handleCreate = useCallback(async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/bookings/manual-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment,
          slot,
          userId: selectedUser?.id ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to create booking')
        return
      }
      onCreated?.()
      onClose()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }, [payment, slot, selectedUser, onCreated, onClose])

  // ── Validation ─────────────────────────────────────────────────────────
  const canAdvance = (): boolean => {
    if (step === 1) return payment.provider !== '' && payment.amount > 0
    if (step === 2) return slot.date !== '' && slotResult?.available === true
    return true // step 3 always allows (user link is optional)
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg rounded-2xl bg-[var(--admin-surface)] border border-[var(--admin-border)] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-[var(--admin-text)]" data-cms-key="manual_booking_title">
              Manual Booking
            </h2>
            <p className="text-xs text-[var(--admin-text-muted)]" data-cms-key="manual_booking_subtitle">
              Create a booking manually with payment evidence
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] hover:bg-[var(--admin-glass-bg)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="border-b border-[var(--admin-border)] px-6 py-3">
          <StepIndicator step={step} />
        </div>

        {/* Step content */}
        <div className="px-6 py-5 min-h-[320px]">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <StepPayment data={payment} onChange={setPayment} />
              </motion.div>
            )}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <StepSlot
                  data={slot}
                  onChange={(d) => {
                    setSlot(d)
                    setSlotResult(null) // reset on change
                  }}
                  slotResult={slotResult}
                  onCheckSlot={checkSlot}
                  checking={checkingSlot}
                />
              </motion.div>
            )}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <StepUser
                  selectedUser={selectedUser}
                  onSelectUser={setSelectedUser}
                  onClearUser={() => setSelectedUser(null)}
                  onSearch={searchUsers}
                  searching={searching}
                  searchResults={searchResults}
                  searchQuery={searchQuery}
                  onSearchQueryChange={setSearchQuery}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
            >
              {error}
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--admin-border)] px-6 py-4">
          <button
            type="button"
            onClick={step === 1 ? onClose : () => setStep((step - 1) as Step)}
            className="flex items-center gap-1 rounded-xl border border-[var(--admin-border)] px-4 py-2.5 text-sm text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] transition-colors"
          >
            {step === 1 ? (
              'Cancel'
            ) : (
              <>
                <ChevronLeft size={16} />
                Back
              </>
            )}
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((step + 1) as Step)}
              disabled={!canAdvance()}
              className="flex items-center gap-1 rounded-xl bg-[var(--admin-brand)] px-4 py-2.5 text-sm font-medium text-black hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Next
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCreate}
              disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-[var(--admin-brand)] px-5 py-2.5 text-sm font-medium text-black hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check size={16} />
                  Create Booking
                </>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
