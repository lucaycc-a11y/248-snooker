'use client'

// ────────────────────────────────────────────────────────────────
// AdminGatewayPanel — admin-only floating dev panel on the payment
// page. Switches the gateway between Stripe (default) and KPay so an
// admin can exercise KPay in production before public launch.
//
// ADDITIVE AND ISOLATED. This component must never be able to affect
// the public Stripe flow:
//   - It renders only when the parent passes isAdmin (server-derived).
//   - It never touches Stripe state, never changes global config.
//   - Its errors stay inside the panel; it fails silent to the page.
//   - The gateway choice is lifted to the parent and is React state
//     only — no config row, no env, no localStorage that outlives the
//     component. It is per session and per tab, exactly as specified.
//
// The panel owns the SWITCH only. Turning the switch to KPay swaps the
// whole checkout area to AdminKPayCheckout in the parent — the method
// list lives there, not here, so there is one source of truth for what
// the admin is about to charge.
//
// Design: borders only (no shadows), 44px min tap targets, mobile-first.
// ────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { tokens } from '@/app/styles/tokens'

export type PanelBlock = {
  date: string
  startHour: number
  duration: number
  tableNumber: 1 | 2
}

type Gateway = 'stripe' | 'kpay'

type Props = {
  /** Server-derived admin flag. The panel is not rendered when false. */
  isAdmin: boolean
  /** Real slots the admin picked in the normal booking flow. */
  blocks: PanelBlock[]
  /** Controlled gateway. Held in the parent so the page can swap UI. */
  value: Gateway
  /** Flip the gateway. Fires immediately; the page re-renders the checkout. */
  onChange: (next: Gateway) => void
}

const POP_EASE = 'cubic-bezier(.34,1.56,.64,1)'

export default function AdminGatewayPanel({ isAdmin, blocks, value, onChange }: Props) {
  const [open, setOpen] = useState(false)

  // bfcache guard. Back-navigation restores this component from the
  // document cache with whatever state it had. A gateway that was left on
  // KPay must not silently resume as KPay — reset to the public default.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return
      setOpen(false)
      onChange('stripe')
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [onChange])

  if (!isAdmin) return null

  return (
    <>
      {/* Floating badge — the only thing mounted when the panel is closed. */}
      <button
        type="button"
        aria-label="Open payment dev panel"
        onClick={() => setOpen((v) => !v)}
        style={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          zIndex: 60,
          minHeight: 44,
          minWidth: 44,
          padding: '0 14px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: tokens.colors.bg,
          color: tokens.colors.textMuted,
          border: `1px solid ${tokens.colors.border}`,
          borderRadius: tokens.radius.pill,
          fontFamily: tokens.font.display,
          fontSize: 11,
          letterSpacing: '0.08em',
          cursor: 'pointer',
        }}
      >
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: 99,
            background: value === 'kpay' ? '#FF9F0A' : tokens.colors.textFaint,
          }}
        />
        PAY
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Payment gateway dev panel"
          style={{
            position: 'fixed',
            right: 16,
            bottom: 72,
            zIndex: 61,
            width: 'min(360px, calc(100vw - 32px))',
            maxHeight: 'min(70vh, 560px)',
            overflowY: 'auto',
            background: tokens.colors.bg,
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: tokens.radius.card,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            // Spec: overshoot ease for the pop entrance.
            animation: `payPanelPop 280ms ${POP_EASE}`,
          }}
        >
          <style>{`
            @keyframes payPanelPop {
              from { opacity: 0; transform: translateY(10px) scale(0.97); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>

          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontFamily: tokens.font.display, fontSize: 13, letterSpacing: '0.1em' }}>
              PAYMENT DEV
            </div>
            <button
              type="button"
              aria-label="Close panel"
              onClick={() => setOpen(false)}
              style={{
                minHeight: 44,
                minWidth: 44,
                background: 'none',
                border: `1px solid ${tokens.colors.border}`,
                borderRadius: tokens.radius.input,
                color: tokens.colors.textMuted,
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          {/* ── Gateway switch ── */}
          <div>
            <div
              style={{
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: tokens.colors.textFaint,
                marginBottom: 8,
                fontFamily: tokens.font.display,
              }}
            >
              Gateway
            </div>
            <div
              role="radiogroup"
              aria-label="Payment gateway"
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}
            >
              {(['stripe', 'kpay'] as const).map((g) => {
                const active = value === g
                return (
                  <button
                    key={g}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onChange(g)}
                    style={{
                      minHeight: 44,
                      background: active ? tokens.colors.surfaceElevated : 'transparent',
                      color: active ? tokens.colors.text : tokens.colors.textMuted,
                      border: `1px solid ${active ? tokens.colors.text : tokens.colors.border}`,
                      borderRadius: tokens.radius.input,
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    {g === 'stripe' ? 'Stripe' : 'KPay'}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Stripe mode: show the mode only, page is untouched ── */}
          {value === 'stripe' && (
            <div
              style={{
                border: `1px solid ${tokens.colors.border}`,
                borderRadius: tokens.radius.input,
                padding: 12,
                fontSize: 12.5,
                color: tokens.colors.textMuted,
                lineHeight: 1.6,
              }}
            >
              <div style={{ color: tokens.colors.text, fontWeight: 600, marginBottom: 4 }}>
                Stripe — live checkout
              </div>
              The public page is in use. Nothing here changes it. Start a payment with the normal
              card form below.
            </div>
          )}

          {/* ── KPay mode: warning only. Methods live in the main UI. ── */}
          {value === 'kpay' && (
            <>
              <div
                role="status"
                style={{
                  border: '1px solid rgba(255,159,10,0.35)',
                  background: 'rgba(255,159,10,0.08)',
                  borderRadius: tokens.radius.input,
                  padding: '10px 12px',
                  fontSize: 12.5,
                  color: '#FF9F0A',
                  lineHeight: 1.5,
                }}
              >
                Production environment. Payments are real.
              </div>

              <div
                style={{
                  border: `1px solid ${tokens.colors.border}`,
                  borderRadius: tokens.radius.input,
                  padding: 12,
                  fontSize: 12.5,
                  color: tokens.colors.textMuted,
                  lineHeight: 1.6,
                }}
              >
                <div style={{ color: tokens.colors.text, fontWeight: 600, marginBottom: 4 }}>
                  KPay — admin test checkout
                </div>
                The main screen is the KPay UI. Orders are created through the admin route and
                stamped <code style={{ fontFamily: tokens.font.display, fontSize: 11 }}>is_test</code>.
                {blocks.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 11, color: tokens.colors.textFaint }}>
                    {blocks.length} slot{blocks.length === 1 ? '' : 's'} selected · {blocks[0].date}{' '}
                    {String(blocks[0].startHour).padStart(2, '0')}:00
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
