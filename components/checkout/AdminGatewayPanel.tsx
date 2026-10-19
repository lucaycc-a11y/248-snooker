'use client'

// ────────────────────────────────────────────────────────────────
// AdminGatewayPanel — admin-only floating dev panel on the payment
// page. Lets an admin switch the gateway between Stripe (default)
// and KPay to exercise KPay in production before public launch.
//
// ADDITIVE AND ISOLATED. This component must never be able to
// affect the public Stripe flow:
//   - It renders only when the parent passes isAdmin (server-derived).
//   - It never touches Stripe state, never changes global config.
//   - Its errors stay inside the panel; it fails silent to the page.
//   - The gateway choice is React state only — no config row, no env,
//     no localStorage that outlives the component. It is per session
//     and per tab, exactly as specified.
//
// Design: borders only (no shadows), 44px min tap targets, mobile-first.
// ────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react'
import { tokens } from '@/app/styles/tokens'

export type PanelBlock = {
  date: string
  startHour: number
  duration: number
  tableNumber: 1 | 2
}

type Props = {
  /** Server-derived admin flag. The panel is not rendered when false. */
  isAdmin: boolean
  /** Real slots the admin picked in the normal booking flow. */
  blocks: PanelBlock[]
}

type Gateway = 'stripe' | 'kpay'

type KPayMethodId =
  | 'card'
  | 'fps'
  | 'payme'
  | 'octopus'
  | 'alipay'
  | 'alipayhk'
  | 'wechat'
  | 'unionpay_qp'

type MethodRow = {
  id: KPayMethodId | 'apple_pay' | 'google_pay'
  label: string
  sublabel: string
  /** apple_pay / google_pay are not ready — visible but inert. */
  disabled: boolean
}

const METHODS: MethodRow[] = [
  { id: 'fps', label: 'FPS', sublabel: '轉數快', disabled: false },
  { id: 'payme', label: 'PayMe', sublabel: 'HSBC PayMe', disabled: false },
  { id: 'octopus', label: 'Octopus', sublabel: '八達通', disabled: false },
  { id: 'alipay', label: 'Alipay', sublabel: '支付寶', disabled: false },
  { id: 'alipayhk', label: 'AlipayHK', sublabel: '香港支付寶', disabled: false },
  { id: 'wechat', label: 'WeChat Pay', sublabel: '微信支付', disabled: false },
  { id: 'card', label: 'Card', sublabel: 'CNP hosted page', disabled: false },
  { id: 'unionpay_qp', label: 'UnionPay QR', sublabel: '雲閃付', disabled: false },
  { id: 'apple_pay', label: 'Apple Pay', sublabel: 'Not available', disabled: true },
  { id: 'google_pay', label: 'Google Pay', sublabel: 'Not available', disabled: true },
]

type StartResult = {
  bookingId: string
  providerOrderNo: string
  payInfo: string
  kind: string
  expiresInSeconds: number
  bookingTotal: number
  kpayAmount: number
  slots: Array<{ slotId: string; date: string; startTime: string; tableNumber: number; price: number }>
  outTradeNo: string
}

const POP_EASE = 'cubic-bezier(.34,1.56,.64,1)'

export default function AdminGatewayPanel({ isAdmin, blocks }: Props) {
  const [open, setOpen] = useState(false)
  const [gateway, setGateway] = useState<Gateway>('stripe')
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<StartResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // bfcache guard. Back-navigation restores this component from the
  // document cache with whatever state it had. A payment that was already
  // started must not look startable again, and the method list must not
  // show a stale in-flight method. Reset to the clean default on restore.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return
      setOpen(false)
      setGateway('stripe')
      setBusy(null)
      setResult(null)
      setError(null)
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  const startPayment = useCallback(
    async (method: KPayMethodId) => {
      if (busy) return
      if (blocks.length === 0) {
        setError('No slot selected — pick a time first.')
        return
      }
      setBusy(method)
      setError(null)
      setResult(null)
      try {
        const res = await fetch('/api/admin/payment-dev/kpay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            method,
            mode: window.innerWidth >= 768 ? 'qr' : 'h5',
            blocks,
          }),
        })
        const data: unknown = await res.json().catch(() => null)
        if (!res.ok) {
          const msg =
            data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
              ? (data as { error: string }).error
              : `Request failed (${res.status})`
          setError(msg)
          return
        }
        setResult(data as StartResult)
      } catch (e) {
        // Fail inside the panel only. The public Stripe flow is untouched.
        setError((e as Error).message || 'Request failed')
      } finally {
        setBusy(null)
      }
    },
    [blocks, busy],
  )

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
            background: gateway === 'kpay' ? '#FF9F0A' : tokens.colors.textFaint,
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
                const active = gateway === g
                return (
                  <button
                    key={g}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setGateway(g)
                      setResult(null)
                      setError(null)
                    }}
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
          {gateway === 'stripe' && (
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

          {/* ── KPay mode ── */}
          {gateway === 'kpay' && (
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    disabled={m.disabled || busy !== null}
                    onClick={() => {
                      if (m.disabled) return
                      void startPayment(m.id as KPayMethodId)
                    }}
                    style={{
                      minHeight: 44,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '0 12px',
                      background: 'transparent',
                      color: m.disabled ? tokens.colors.textFaint : tokens.colors.text,
                      border: `1px solid ${m.disabled ? tokens.colors.border : tokens.colors.borderStrong}`,
                      borderRadius: tokens.radius.input,
                      cursor: m.disabled ? 'not-allowed' : 'pointer',
                      opacity: m.disabled ? 0.55 : 1,
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span style={{ fontWeight: 600, fontSize: 13.5 }}>{m.label}</span>
                      <span style={{ fontSize: 11.5, color: tokens.colors.textFaint }}>{m.sublabel}</span>
                    </span>
                    <span style={{ fontSize: 11, color: tokens.colors.textFaint, whiteSpace: 'nowrap' }}>
                      {m.disabled ? '—' : busy === m.id ? 'Starting…' : 'Start'}
                    </span>
                  </button>
                ))}
              </div>

              {error && (
                <div
                  role="alert"
                  style={{
                    border: `1px solid ${tokens.colors.danger}`,
                    background: 'rgba(255,69,58,0.08)',
                    borderRadius: tokens.radius.input,
                    padding: '10px 12px',
                    fontSize: 12.5,
                    color: tokens.colors.danger,
                    lineHeight: 1.5,
                    wordBreak: 'break-word',
                  }}
                >
                  {error}
                </div>
              )}

              {result && (
                <div
                  style={{
                    border: `1px solid ${tokens.colors.border}`,
                    borderRadius: tokens.radius.input,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    fontSize: 12,
                    color: tokens.colors.textMuted,
                  }}
                >
                  <div style={{ color: tokens.colors.text, fontWeight: 600 }}>Order created</div>
                  <div>
                    Booking <span style={{ fontFamily: tokens.font.display }}>{result.outTradeNo}</span>
                  </div>
                  <div>
                    Charged HK${result.kpayAmount.toFixed(2)} on KPay · booking total HK$
                    {result.bookingTotal.toFixed(2)} (is_test)
                  </div>
                  <div>Kind: {result.kind}</div>
                  {(result.kind === 'qr' || result.kind === 'link' || result.kind === 'redirect') && (
                    <a
                      href={result.payInfo}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        minHeight: 44,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `1px solid ${tokens.colors.borderStrong}`,
                        borderRadius: tokens.radius.input,
                        color: tokens.colors.text,
                        textDecoration: 'none',
                        fontWeight: 600,
                      }}
                    >
                      Open payment
                    </a>
                  )}
                  {result.kind === 'form-post' && (
                    <FormPostButton payInfo={result.payInfo} />
                  )}
                  {result.slots.length > 0 && (
                    <div style={{ fontSize: 11, color: tokens.colors.textFaint }}>
                      Slot: {result.slots[0].date} {result.slots[0].startTime} · Table{' '}
                      {result.slots[0].tableNumber}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}

/**
 * `form-post` payInfo is a JSON field map with `action` + `method`, not a URL.
 * Assigning it to location.href would navigate to a relative path made of
 * literal braces — the failure mode documented on PayInfoKind.
 */
function FormPostButton({ payInfo }: { payInfo: string }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [action, setAction] = useState<string>('')
  const [method, setMethod] = useState<'get' | 'post'>('post')
  const [bad, setBad] = useState(false)

  useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(payInfo)
      if (!parsed || typeof parsed !== 'object') {
        setBad(true)
        return
      }
      const rec = parsed as Record<string, unknown>
      const act = rec.action
      if (typeof act !== 'string') {
        setBad(true)
        return
      }
      setAction(act)
      setMethod(rec.method === 'get' ? 'get' : 'post')
      const rest: Record<string, string> = {}
      for (const [k, v] of Object.entries(rec)) {
        if (k === 'action' || k === 'method') continue
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
          rest[k] = String(v)
        }
      }
      setFields(rest)
    } catch {
      setBad(true)
    }
  }, [payInfo])

  if (bad) {
    return <div style={{ fontSize: 12, color: tokens.colors.danger }}>Unrecognised payment payload.</div>
  }

  return (
    <form
      ref={formRef}
      action={action}
      method={method}
      target="_blank"
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button
        type="submit"
        style={{
          minHeight: 44,
          border: `1px solid ${tokens.colors.borderStrong}`,
          borderRadius: tokens.radius.input,
          color: tokens.colors.text,
          background: 'transparent',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Open payment
      </button>
    </form>
  )
}
