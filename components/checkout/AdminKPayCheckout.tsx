'use client'

// ────────────────────────────────────────────────────────────────
// AdminKPayCheckout — the whole checkout UI when an admin switches
// the gateway dev panel to KPay. Replaces the Stripe card form.
//
// ADDITIVE AND ADMIN-ONLY. The parent renders this only when
// `isAdmin && adminGateway === 'kpay'`. For everyone else the public
// Stripe path is what mounts.
//
// Endpoint invariant: this component creates orders ONLY through
// /api/admin/payment-dev/kpay, which forces bookings.is_test = true
// server-side. It must never call /api/checkout/create or
// /api/payment/create-intent — those stamp is_test from the hostname,
// which is false in production and would mint a real, revenue-counting
// booking. Status polling is read-only and reuses the shared
// useOrderConfirmationPolling hook, which hits /api/checkout/status.
//
// Visual language matches the public KPay rails screen: borders only
// (no shadows), 44px min tap targets, mobile-first.
// ────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react'
import { tokens } from '@/app/styles/tokens'
import { useOrderConfirmationPolling } from '@/lib/booking/useOrderConfirmationPolling'

export type AdminKPayBlock = {
  date: string
  startHour: number
  duration: number
  tableNumber: 1 | 2
}

type Props = {
  blocks: AdminKPayBlock[]
  /** Flips the parent's gateway back to Stripe. Always available. */
  onBackToStripe: () => void
}

type AdminKPayMethodId =
  | 'fps'
  | 'payme'
  | 'octopus'
  | 'alipay'
  | 'alipayhk'
  | 'wechat'
  | 'unionpay_qp'
  | 'card'

type MethodRow = {
  id: AdminKPayMethodId | 'apple_pay' | 'google_pay'
  label: string
  sublabel: string
  disabled: boolean
}

/**
 * Real KPay rails first, Card last as the FPS fallback. Apple Pay and
 * Google Pay are not wired to KPay yet — visible so the gap is obvious,
 * inert so nothing can be started against them.
 */
const METHODS: MethodRow[] = [
  { id: 'fps', label: 'FPS', sublabel: '轉數快', disabled: false },
  { id: 'payme', label: 'PayMe', sublabel: 'HSBC PayMe', disabled: false },
  { id: 'octopus', label: 'Octopus', sublabel: '八達通', disabled: false },
  { id: 'alipay', label: 'Alipay', sublabel: '支付寶', disabled: false },
  { id: 'alipayhk', label: 'AlipayHK', sublabel: '香港支付寶', disabled: false },
  { id: 'wechat', label: 'WeChat Pay', sublabel: '微信支付', disabled: false },
  { id: 'unionpay_qp', label: 'UnionPay QR', sublabel: '雲閃付', disabled: false },
  { id: 'card', label: 'Card', sublabel: 'CNP hosted page · FPS fallback', disabled: false },
  { id: 'apple_pay', label: 'Apple Pay', sublabel: 'Not available', disabled: true },
  { id: 'google_pay', label: 'Google Pay', sublabel: 'Not available', disabled: true },
]

type CreatedOrder = {
  bookingId: string
  providerOrderNo: string
  payInfo: string
  kind: string
  expiresInSeconds: number
  bookingTotal: number
  kpayAmount: number
  outTradeNo: string
  slots: Array<{ slotId: string; date: string; startTime: string; tableNumber: number; price: number }>
}

type Stage = 'methods' | 'pay' | 'done'

/** Statuses the shared polling hook can report, read once for the copy. */
type PollStatus = 'pending' | 'pending_confirmation' | 'success' | 'failed' | 'cancelled' | 'expired' | 'timeout'

export default function AdminKPayCheckout({ blocks, onBackToStripe }: Props) {
  const [stage, setStage] = useState<Stage>('methods')
  const [method, setMethod] = useState<AdminKPayMethodId | null>(null)
  const [order, setOrder] = useState<CreatedOrder | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // bfcache: returning from an external wallet restores this component with
  // a half-finished order. Drop back to a clean method list so the admin
  // cannot start a second charge against a dead order.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return
      setStage('methods')
      setMethod(null)
      setOrder(null)
      setBusy(false)
      setError(null)
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  // Leaving KPay mode unmounts this component. Nothing to clean up beyond
  // letting the polling hook's effect tear down with us.

  const startPayment = useCallback(
    async (m: AdminKPayMethodId) => {
      if (busy) return
      if (blocks.length === 0) {
        setError('No slot selected — pick a time first.')
        return
      }
      setBusy(true)
      setError(null)
      setMethod(m)
      try {
        const res = await fetch('/api/admin/payment-dev/kpay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            method: m,
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
          setStage('methods')
          return
        }
        if (!isCreatedOrder(data)) {
          setError('Unrecognised order response.')
          setStage('methods')
          return
        }
        setOrder(data)
        setStage('pay')
      } catch (e) {
        setError((e as Error).message || 'Request failed')
        setStage('methods')
      } finally {
        setBusy(false)
      }
    },
    [blocks, busy],
  )

  const resetToMethods = useCallback(() => {
    setStage('methods')
    setMethod(null)
    setOrder(null)
    setError(null)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Amber production warning — always above the KPay UI. */}
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

      {/* Mode header — makes it unmistakable which gateway is live. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontFamily: tokens.font.display, fontSize: 13, letterSpacing: '0.1em' }}>KPAY</div>
          <div style={{ fontSize: 12, color: tokens.colors.textFaint, marginTop: 2 }}>
            {stage === 'methods' ? 'Choose a payment method' : 'Complete the payment'}
          </div>
        </div>
        <button
          type="button"
          onClick={onBackToStripe}
          style={{
            minHeight: 44,
            padding: '0 12px',
            background: 'transparent',
            color: tokens.colors.textMuted,
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: tokens.radius.input,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 12.5,
          }}
        >
          Back to Stripe
        </button>
      </div>

      {stage === 'methods' && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={m.disabled || busy}
                onClick={() => {
                  if (m.disabled) return
                  if (m.id === 'apple_pay' || m.id === 'google_pay') return
                  void startPayment(m.id)
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
                  {m.disabled ? '—' : busy && method === m.id ? 'Starting…' : 'Start'}
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
        </>
      )}

      {(stage === 'pay' || stage === 'done') && order && (
        <PaidStage
          order={order}
          method={method}
          stage={stage}
          onBackToMethods={resetToMethods}
          onBackToStripe={onBackToStripe}
        />
      )}
    </div>
  )
}

function isCreatedOrder(value: unknown): value is CreatedOrder {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.bookingId === 'string' &&
    typeof v.providerOrderNo === 'string' &&
    typeof v.payInfo === 'string' &&
    typeof v.kind === 'string' &&
    typeof v.expiresInSeconds === 'number' &&
    typeof v.bookingTotal === 'number' &&
    typeof v.kpayAmount === 'number' &&
    typeof v.outTradeNo === 'string'
  )
}

function PaidStage({
  order,
  method,
  stage,
  onBackToMethods,
  onBackToStripe,
}: {
  order: CreatedOrder
  method: AdminKPayMethodId | null
  stage: Stage
  onBackToMethods: () => void
  onBackToStripe: () => void
}) {
  // Reuses the shared confirmation poller. It hits /api/checkout/status,
  // which is read-only and scoped to the signed-in user — the admin owns
  // this booking because the admin route inserts user_id = adminUserId.
  const poll = useOrderConfirmationPolling(order.bookingId, stage === 'pay')
  const status = poll.status as PollStatus

  const succeeded = status === 'success' || stage === 'done'
  const settled = succeeded || status === 'failed' || status === 'cancelled' || status === 'expired' || status === 'timeout'

  useEffect(() => {
    if (status === 'success') {
      // Keep the success screen; stop polling by unmounting is unnecessary
      // because the hook is already `enabled=false` once stage flips.
    }
  }, [status])

  return (
    <div
      style={{
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: tokens.radius.card,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {/* Order identity — the numbers Luca needs to confirm slot release. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: tokens.colors.textMuted }}>
        <div>
          Booking <span style={{ fontFamily: tokens.font.display, color: tokens.colors.text }}>{order.outTradeNo}</span>
        </div>
        <div>
          KPay charged HK${order.kpayAmount.toFixed(2)} · booking total HK${order.bookingTotal.toFixed(2)} (is_test)
        </div>
        {order.slots.length > 0 && (
          <div style={{ color: tokens.colors.textFaint }}>
            Slot: {order.slots[0].date} {order.slots[0].startTime} · Table {order.slots[0].tableNumber}
          </div>
        )}
      </div>

      {succeeded ? (
        <div
          role="status"
          style={{
            border: `1px solid ${tokens.colors.green[600]}`,
            borderRadius: tokens.radius.input,
            padding: '12px 14px',
            fontSize: 13,
            lineHeight: 1.5,
            color: tokens.colors.text,
          }}
        >
          Payment confirmed. The booking is stamped is_test — remember to cancel it after the test.
        </div>
      ) : settled ? (
        <div
          role="alert"
          style={{
            border: `1px solid ${tokens.colors.danger}`,
            borderRadius: tokens.radius.input,
            padding: '12px 14px',
            fontSize: 13,
            lineHeight: 1.5,
            color: tokens.colors.danger,
          }}
        >
          {status === 'timeout'
            ? 'Timed out waiting for confirmation. The booking is still pending — check the payment log before retrying.'
            : `Payment ${status}.`}
        </div>
      ) : (
        <>
          <PayPayload kind={order.kind} payInfo={order.payInfo} />

          <div style={{ fontSize: 12, color: tokens.colors.textFaint, lineHeight: 1.5 }}>
            Waiting for confirmation… {poll.elapsedSec}s
            {poll.hold.active && poll.hold.expiresAt ? ' · slot held' : ''}
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {settled && (
          <button
            type="button"
            onClick={onBackToMethods}
            style={{
              minHeight: 44,
              padding: '0 14px',
              background: 'transparent',
              color: tokens.colors.text,
              border: `1px solid ${tokens.colors.borderStrong}`,
              borderRadius: tokens.radius.input,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Test another method
          </button>
        )}
        <button
          type="button"
          onClick={onBackToStripe}
          style={{
            minHeight: 44,
            padding: '0 14px',
            background: 'transparent',
            color: tokens.colors.textMuted,
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: tokens.radius.input,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Back to Stripe
        </button>
      </div>

      {method && (
        <div style={{ fontSize: 11, color: tokens.colors.textFaint }}>
          Method: {method} · order {order.providerOrderNo}
        </div>
      )}
    </div>
  )
}

/**
 * Renders the KPay payload by `kind`. `form-post` is a JSON field map with
 * an `action`, never a URL — assigning it to location.href navigates to a
 * relative path made of literal braces.
 */
function PayPayload({ kind, payInfo }: { kind: string; payInfo: string }) {
  if (kind === 'form-post') return <FormPostButton payInfo={payInfo} />

  if (kind === 'qr') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
        <div style={{ fontSize: 12.5, color: tokens.colors.textMuted }}>Scan with the wallet app</div>
        <img
          src={payInfo}
          alt="KPay payment QR code"
          style={{
            width: 180,
            height: 180,
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: tokens.radius.input,
            display: 'block',
          }}
        />
      </div>
    )
  }

  if (kind === 'redirect' || kind === 'link') {
    return (
      <a
        href={payInfo}
        target="_blank"
        rel="noreferrer"
        style={{
          minHeight: 44,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 16px',
          border: `1px solid ${tokens.colors.borderStrong}`,
          borderRadius: tokens.radius.input,
          color: tokens.colors.text,
          textDecoration: 'none',
          fontWeight: 600,
        }}
      >
        Open payment
      </a>
    )
  }

  // `client_secret` and anything unknown — show the raw value rather than
  // navigating to it. The admin can copy it into a wallet tool if needed.
  return (
    <div
      style={{
        fontSize: 11,
        color: tokens.colors.textFaint,
        fontFamily: 'ui-monospace, monospace',
        wordBreak: 'break-all',
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: tokens.radius.input,
        padding: 10,
      }}
    >
      {kind}: {payInfo}
    </div>
  )
}

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
