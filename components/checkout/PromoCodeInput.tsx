'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Tag, X, Check, Loader2 } from 'lucide-react'

const GREEN = '#22C55E'
const DANGER = '#FF453A'
const MUTED = '#A1A1A6'
const BORDER = 'rgba(255,255,255,0.1)'
const GLASS_BG = 'rgba(255,255,255,0.05)'
const INK = '#f5f5f7'

const SPRING = { type: 'spring', stiffness: 320, damping: 30 } as const
const EASE = [0.16, 1, 0.3, 1] as const

type PromoResult = {
  code: string
  discount_type: 'percentage' | 'fixed_amount'
  discount_value: number
  discount_amount: number
  final_amount: number
}

type Props = {
  originalTotal: number
  onApply: (result: PromoResult) => void
  onRemove: () => void
  activeCode: PromoResult | null
  labels?: {
    placeholder: string
    applyLabel: string
    removeLabel: string
    discountLabel: string
    invalidLabel: string
    expiredLabel: string
    minCartLabel: string
    validatingLabel: string
  }
}

const DEFAULT_LABELS = {
  placeholder: 'Promo code',
  applyLabel: 'Apply',
  removeLabel: 'Remove',
  discountLabel: 'Discount',
  invalidLabel: 'Invalid code',
  expiredLabel: 'Code expired',
  minCartLabel: 'Minimum order not met',
  validatingLabel: 'Checking...',
}

export default function PromoCodeInput({ originalTotal, onApply, onRemove, activeCode, labels: lbl }: Props) {
  const L = { ...DEFAULT_LABELS, ...lbl }
  const [code, setCode] = useState('')
  const [open, setOpen] = useState(false)
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-apply promo code from URL param (?promo=) — stored in sessionStorage
  // by the book page during the prefill step. Only fires once, when originalTotal
  // becomes available (the user has selected slots and a price is quoted).
  useEffect(() => {
    if (!originalTotal || originalTotal <= 0) return
    if (activeCode) return // already applied
    const pending = sessionStorage.getItem('pendingPromo')
    if (!pending) return
    // Clear immediately to prevent re-application on re-render
    sessionStorage.removeItem('pendingPromo')
    // Auto-validate the promo code
    setCode(pending)
    ;(async () => {
      setOpen(true)
      setValidating(true)
      try {
        const res = await fetch('/api/booking/validate-promo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: pending, cartAmount: originalTotal }),
        })
        const data = await res.json()
        if (data.valid) {
          onApply({
            code: data.code,
            discount_type: data.discount_type as 'percentage' | 'fixed_amount',
            discount_value: data.discount_value as number,
            discount_amount: data.discount_amount as number,
            final_amount: data.final_amount as number,
          })
        }
      } catch {} finally {
        setValidating(false)
        setCode('')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalTotal])

  const validate = useCallback(async () => {
    const trimmed = code.trim()
    if (!trimmed) return
    setValidating(true)
    setError(null)

    try {
      const res = await fetch('/api/booking/validate-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed, cartAmount: originalTotal }),
      })

      const data = await res.json()
      if (!data.valid) {
        const reason = data.reason
        setError(
          reason === 'invalid_or_expired' ? L.expiredLabel
            : reason === 'min_cart_not_met' ? L.minCartLabel
            : L.invalidLabel
        )
        return
      }

      onApply({
        code: data.code,
        discount_type: data.discount_type as 'percentage' | 'fixed_amount',
        discount_value: data.discount_value as number,
        discount_amount: data.discount_amount as number,
        final_amount: data.final_amount as number,
      })
      setCode('')
      setError(null)
    } catch {
      setError(L.invalidLabel)
    } finally {
      setValidating(false)
    }
  }, [code, originalTotal, onApply, L])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (activeCode) {
        setCode('')
        onRemove()
      } else {
        validate()
      }
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Applied code badge */}
      {activeCode ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={SPRING}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            borderRadius: 14,
            border: `1px solid rgba(34,197,94,0.25)`,
            background: 'rgba(34,197,94,0.08)',
            marginBottom: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(34,197,94,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Check size={14} color={GREEN} strokeWidth={2.5} />
            </span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {activeCode.code}
              </div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>
                {L.discountLabel}: −HK${activeCode.discount_amount} ({activeCode.discount_type === 'percentage' ? `${activeCode.discount_value}%` : `HK$${activeCode.discount_value}`})
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setCode(''); onRemove() }}
            style={{
              background: 'none', border: 'none', color: MUTED, cursor: 'pointer',
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '50%',
            }}
            title={L.removeLabel}
          >
            <X size={16} />
          </button>
        </motion.div>
      ) : open ? (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null) }}
                onKeyDown={handleKeyDown}
                placeholder={L.placeholder}
                autoFocus
                style={{
                  width: '100%',
                  minHeight: 46,
                  padding: '0 16px',
                  borderRadius: 14,
                  border: `1px solid ${error ? DANGER : BORDER}`,
                  background: GLASS_BG,
                  color: INK,
                  fontSize: 14,
                  fontFamily: 'inherit',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {validating && (
                <Loader2 size={14} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: MUTED }} className="spin" />
              )}
            </div>
            <button
              type="button"
              onClick={validate}
              disabled={validating || !code.trim()}
              style={{
                minHeight: 46,
                padding: '0 18px',
                borderRadius: 14,
                border: 'none',
                background: code.trim() && !validating ? GREEN : 'rgba(255,255,255,0.1)',
                color: code.trim() && !validating ? '#000' : MUTED,
                fontSize: 14,
                fontWeight: 600,
                cursor: code.trim() && !validating ? 'pointer' : 'default',
                whiteSpace: 'nowrap',
              }}
            >
              {validating ? L.validatingLabel : L.applyLabel}
            </button>
          </div>
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{ fontSize: 12, color: DANGER, margin: '6px 0 0 4px' }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderRadius: 999,
            border: `1px solid ${BORDER}`,
            background: 'transparent',
            color: MUTED,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Tag size={14} strokeWidth={2} />
          {L.placeholder}
        </button>
      )}
    </div>
  )
}