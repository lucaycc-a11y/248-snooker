"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { CircleCheck, CircleX, Clock3 } from 'lucide-react'
import { tokens } from '@/app/styles/tokens'

// ── Types ────────────────────────────────────────────────────────────────────

export type KPayMethod = 'card' | 'fps' | 'payme' | 'octopus' | 'alipay' | 'alipayhk' | 'wechat' | 'unionpay_qp'

export type KPayState =
  | 'idle'          // initial — not yet created
  | 'pending'       // QR/H5 shown, awaiting customer payment
  | 'pending_confirmation' // provider succeeded, DB confirmation is pending
  | 'success'       // payment confirmed
  | 'failed'        // payment failed
  | 'cancelled'     // booking hold was cancelled
  | 'expired'       // QR/H5 link expired

export type KPayMode = 'qr' | 'h5'

export type KPayBlock = {
  date: string
  startHour: number
  duration: number
  tableNumber: 1 | 2
}

export type KPayLabels = {
  title: string
  pending: string
  pending_desc: string
  pending_confirmation: string
  pending_confirmation_desc: string
  success: string
  success_desc: string
  failed: string
  failed_desc: string
  expired: string
  expired_desc: string
  regenerate: string
  try_again: string
  countdown: string
  help: string
  support_whatsapp: string
  back_to_methods: string
  waited: string
  cancelled: string
  cancelled_desc: string
  cancel: string
  processing: string
  terms_required: string
}

type Props = {
  /** Blocks to lock+book (Mode A — the KPay path creates bookings server-side) */
  blocks: KPayBlock[]
  /** Existing bookingId (Mode B — for re-creates after expiry) */
  bookingId?: string
  orderGroupId?: string
  method: KPayMethod
  mode: KPayMode
  labels: KPayLabels
  agreedToTerms: boolean
  /** Member points to redeem, 0 = none. Re-validated and reserved server-side by
   * prepare_checkout; the amount KPay charges comes back from that RPC, never
   * from this component. */
  pointsAmount?: number
  /** Resume an in-progress payment after page refresh — skip order creation and
   * restore the existing bookingId/orderNo directly. */
  resumeBookingId?: string
  resumeOrderNo?: string
  onBackToMethods: () => void
  onSuccess: (bookingId?: string) => void
}

// ── SessionStorage key for refresh recovery ─────────────────────────────────
const KPAY_SESSION_KEY = 'kpayPayment'

type KPayPersistedState = {
  bookingId: string
  providerOrderNo: string
  method: KPayMethod
  mode: KPayMode
  orderGroupId?: string
  agreedToTerms: boolean
  /** Timestamp to expire stale entries (30 min) */
  savedAt: number
}

function persistKPayState(data: KPayPersistedState) {
  try {
    sessionStorage.setItem(KPAY_SESSION_KEY, JSON.stringify(data))
  } catch { /* quota or private browsing — non-fatal */ }
}

export function readKPayPersistedState(): KPayPersistedState | null {
  try {
    const raw = sessionStorage.getItem(KPAY_SESSION_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const s = parsed as Record<string, unknown>
    if (typeof s.bookingId !== 'string' || typeof s.providerOrderNo !== 'string') return null
    // Expire after 30 minutes — stale entries should not block new orders
    if (typeof s.savedAt === 'number' && Date.now() - s.savedAt > 30 * 60_000) {
      sessionStorage.removeItem(KPAY_SESSION_KEY)
      return null
    }
    return s as unknown as KPayPersistedState
  } catch {
    return null
  }
}

export function clearKPayPersistedState() {
  try { sessionStorage.removeItem(KPAY_SESSION_KEY) } catch {}
}

// ── Gateway form POST (Alipay H5) ────────────────────────────────────────────

/**
 * Submit a JSON parameter map to a payment gateway as an HTML form submit.
 *
 * Alipay H5 returns its parameters as JSON rather than a URL; the gateway
 * expects them as form fields, with the target URL and HTTP method carried
 * INSIDE the JSON itself (`action` / `method`) — not assumed by us. Assigning
 * the JSON to location.href yields https://site/{"service":...}, which is
 * the bug this branch prevents.
 *
 * Returns false when payInfo cannot be parsed or carries no usable action,
 * so the caller can surface an error instead of leaving the user stalled.
 */
function submitGatewayForm(payInfo: string): boolean {
  let fields: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(payInfo)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return false
    fields = parsed as Record<string, unknown>
  } catch {
    return false
  }

  const action = fields.action
  console.log('[Alipay form-post] fields:', JSON.stringify(fields))
  if (typeof action !== 'string' || !/^https:\/\//i.test(action)) return false

  const form = document.createElement('form')
  // Trust the gateway's own method field; default to POST only when it does
  // not explicitly say GET (KPay's docs show payloads with either).
  form.method = typeof fields.method === 'string' && fields.method.toUpperCase() === 'GET' ? 'GET' : 'POST'
  form.action = action
  form.style.display = 'none'

  // `action`/`method` address the form — they are not fields the gateway
  // expects back as form data.
  let fieldCount = 0
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'action' || key === 'method') continue
    if (value === null || value === undefined) continue
    if (typeof value === 'object') continue

    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = key
    input.value = String(value)
    form.appendChild(input)
    fieldCount++
  }

  if (fieldCount === 0) return false

  document.body.appendChild(form)
  form.submit()
  return true
}

// ── Method display names ─────────────────────────────────────────────────────

const METHOD_NAMES: Record<KPayMethod, string> = {
  card: '信用卡',
  fps: 'FPS 轉數快',
  payme: 'PayMe',
  octopus: '八達通',
  alipay: '支付寶',
  alipayhk: 'AlipayHK',
  wechat: '微信支付',
  unionpay_qp: '雲閃付',
}

// ── Color tokens (Space8 design system — never Tailwind greens) ──────────────

const GREEN = '#1a9d5c'
const GREEN_BRIGHT = '#22b86b'
const GREEN_DEEP = '#0f7845'
const BG = '#000000'
const SURFACE = '#111111'
const TEXT = '#ffffff'
const TEXT_MUTED = 'rgba(255,255,255,0.72)'
const TEXT_FAINT = 'rgba(255,255,255,0.52)'
const BORDER = 'rgba(255,255,255,0.1)'
const DANGER = '#FF453A'

// ── Easing curves ────────────────────────────────────────────────────────────

const EASE_SPRING = 'cubic-bezier(.34,1.56,.64,1)'
const EASE_STANDARD = 'cubic-bezier(.2,.7,.3,1)'

// ── Polling cadence (mirrors useOrderConfirmationPolling) ────────────────────
// Fast 2 s for the first 30 s (webhooks are near-instant), then back off to 5 s
// until the component unmounts or the booking resolves.
const KPAY_POLL_FAST_MS = 2_000
const KPAY_POLL_SLOW_MS = 5_000
const KPAY_POLL_FAST_PHASE_MS = 30_000
/** Hard ceiling: if polling has been running this long without resolution, stop
 *  and show the user a clear "we're still checking" state instead of polling
 *  forever. Matches useOrderConfirmationPolling's DEFAULT_TIMEOUT_MS. */
const KPAY_POLL_TIMEOUT_MS = 60_000

// ── Component ────────────────────────────────────────────────────────────────

export default function KPayPayment(props: Props) {
  const {
    blocks, bookingId, orderGroupId, method, mode, labels, agreedToTerms,
    resumeBookingId, resumeOrderNo, onBackToMethods, onSuccess,
  } = props
  const pointsAmount = props.pointsAmount ?? 0

  // ── UAT-ONLY PayMe test simulation selector ───────────────────────────────
  // Read `?uat_payme=success` or `?uat_payme=fail` from the URL once on mount.
  // The toggle UI lets the tester switch modes without editing the URL.
  // Server-side: only applies when KPAY_ENV !== 'prod' AND method === 'payme'.
  const [uatPaymeSimulation, setUatPaymeSimulation] = useState<'success' | 'fail' | undefined>(() => {
    try {
      const v = new URLSearchParams(window.location.search).get('uat_payme')
      return v === 'success' || v === 'fail' ? v : undefined
    } catch { return undefined }
  })
  const uatPaymeSimRef = useRef(uatPaymeSimulation)
  useEffect(() => { uatPaymeSimRef.current = uatPaymeSimulation }, [uatPaymeSimulation])
  // ──────────────────────────────────────────────────────────────────────────

  // Resume mode: when resumeBookingId is provided, the component restores an
  // in-progress payment instead of creating a new order. This survives page
  // refresh because book/page.tsx persists the KPay state to sessionStorage.
  const resuming = Boolean(resumeBookingId)

  const [state, setState] = useState<KPayState>(resuming ? 'pending' : 'idle')
  const [payInfo, setPayInfo] = useState<string | null>(null)
  // Server-decided payInfo shape (see getPayInfoKind in lib/payments/kpay.ts) —
  // authoritative over the `mode` prop, since e.g. unionpay_qp has no real H5
  // variant and always comes back as 'qr' regardless of the requested mode.
  const [kind, setKind] = useState<string | null>(null)
  const [providerOrderNo, setProviderOrderNo] = useState<string | null>(resumeOrderNo ?? null)
  const [localBookingId, setLocalBookingId] = useState<string | undefined>(resumeBookingId ?? bookingId)
  const [localOrderGroupId, setLocalOrderGroupId] = useState<string | undefined>(orderGroupId)
  const [expiresIn, setExpiresIn] = useState<number>(0)
  const [countdown, setCountdown] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [failureReason, setFailureReason] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const creatingRef = useRef(false)
  const attemptRef = useRef(0)
  const pollStartRef = useRef(Date.now())
  const resumingRef = useRef(resuming)
  // Stale-closure guards: keep refs in sync so the polling useEffect can have
  // a stable dependency array and avoid re-launching on every state/prop change.
  const stateRef = useRef<KPayState>(state)
  const onSuccessRef = useRef(onSuccess)

  // Keep refs current without re-triggering the polling effect.
  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { onSuccessRef.current = onSuccess }, [onSuccess])

  // ── Create order (idempotent) ──────────────────────────────────────────────

  const createOrder = useCallback(async () => {
    if (!agreedToTerms) {
      setError('請先同意條款與細則')
      setState('failed')
      return
    }
    if (creatingRef.current) return
    creatingRef.current = true
    setCreating(true)
    setError(null)
    setFailureReason(null)

    try {
      const body: Record<string, unknown> = {
        method,
        mode,
        agreedToTerms,
      }
      if (pointsAmount > 0) {
        body.pointsAmount = pointsAmount
      }
      // UAT-ONLY: include PayMe test simulation selector when present in URL
      if (uatPaymeSimulation) {
        body.uat_payme = uatPaymeSimulation
      }

      // Mode A: blocks[] — the KPay path creates bookings server-side
      if (blocks && blocks.length > 0 && !localBookingId) {
        body.blocks = blocks.map((b) => ({
          date: b.date,
          startHour: b.startHour,
          duration: b.duration,
          tableNumber: b.tableNumber,
        }))
      } else {
        // Mode B: existing bookingId (re-create after expiry or retry)
        body.bookingId = localBookingId
        body.orderGroupId = localOrderGroupId
      }

      const res = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        let message = '付款初始化失敗，請重試'
        try {
          const errBody = await res.json()
          message = errBody.error || message
        } catch {
          // non-JSON response (e.g. unexpected HTML error page) — use default
        }
        setError(message)
        setState('failed')
        return
      }

      const json = await res.json()

      // Redirect responses must leave the page before committing pending UI
      // state; card/CNP Hosted must never briefly render the QR screen.
      if ((json.kind === 'redirect' || json.kind === 'link') && json.payInfo) {
        if (!/^(https?:\/\/|[a-z][a-z0-9+.-]*:)/i.test(json.payInfo.trim())) {
          setError('付款閘道回應格式錯誤，請重試或改用其他付款方式')
          setState('failed')
          return
        }
        window.location.href = json.payInfo
        return
      }

      setProviderOrderNo(json.providerOrderNo)
      setPayInfo(json.payInfo)
      setKind(json.kind)
      setExpiresIn(json.expiresInSeconds)
      setCountdown(json.expiresInSeconds)
      // Mode A returns bookingId/orderGroupId — remember them so re-creates
      // (after expiry) use Mode B on the SAME booking instead of re-locking.
      if (json.bookingId) setLocalBookingId(String(json.bookingId))
      if (json.orderGroupId) setLocalOrderGroupId(String(json.orderGroupId))
      setState('pending')

      // Persist to sessionStorage so a page refresh can resume this payment
      // instead of creating a duplicate order.
      persistKPayState({
        bookingId: String(json.bookingId ?? localBookingId),
        providerOrderNo: json.providerOrderNo,
        method,
        mode,
        agreedToTerms: true,
        savedAt: Date.now(),
      })

      // 'form-post' payInfo is a JSON field map, not a URL — it must be POSTed
      // as a form instead of assigned to location.href.
      if (json.kind === 'form-post') {
        if (!submitGatewayForm(json.payInfo)) {
          setError('付款閘道回應格式錯誤，請重試或改用其他付款方式')
          setState('failed')
        }
        return
      }
    } catch (e) {
      setError((e as Error).message)
      setState('failed')
    } finally {
      creatingRef.current = false
      setCreating(false)
    }
  }, [agreedToTerms, blocks, localBookingId, localOrderGroupId, method, mode, pointsAmount, uatPaymeSimulation])

  const cancelBooking = useCallback(async () => {
    if (actionBusy) return
    if (!localBookingId) {
      onBackToMethods()
      return
    }

    setActionBusy(true)
    try {
      const res = await fetch('/api/checkout/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: localBookingId }),
      })
      const payload: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        const message = payload && typeof payload === 'object' && !Array.isArray(payload)
          ? (payload as Record<string, unknown>).error
          : undefined
        setError(typeof message === 'string' ? message : labels.cancelled_desc)
        return
      }
      attemptRef.current += 1
      if (countdownRef.current) clearInterval(countdownRef.current)
      setState('cancelled')
    } catch {
      setError(labels.cancelled_desc)
    } finally {
      setActionBusy(false)
    }
  }, [actionBusy, labels.cancelled_desc, localBookingId, onBackToMethods])

  const retryPayment = useCallback(async () => {
    if (actionBusy || !localBookingId) return
    setActionBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/checkout/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: localBookingId }),
      })
      const payload: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        const message = payload && typeof payload === 'object' && !Array.isArray(payload)
          ? (payload as Record<string, unknown>).error
          : undefined
        setError(typeof message === 'string' ? message : labels.failed_desc)
        setState('failed')
        return
      }
      attemptRef.current += 1
      setPayInfo(null)
      setKind(null)
      setProviderOrderNo(null)
      setCountdown(0)
      setElapsedSec(0)
      // Part 2: after resetting the failed booking, return to the payment-method
      // picker so the user can re-select a method — the fresh selection triggers
      // a new KPay session (createOrder on mount) instead of silently re-using
      // the same method.
      console.log('[KPay] userRetried', {
        bookingId: localBookingId,
        elapsedMs: Date.now() - pollStartRef.current,
      })
      onBackToMethods()
    } catch {
      setError(labels.failed_desc)
      setState('failed')
    } finally {
      setActionBusy(false)
    }
  }, [actionBusy, labels.failed_desc, localBookingId, onBackToMethods])

  // ── Create order on mount ─────────────────────────────────────────────────

  useEffect(() => {
    // When resuming (page refresh), skip createOrder — the resume effect below
    // handles restoring state from the persisted bookingId/orderNo.
    if (resumingRef.current) {
      resumingRef.current = false
      return
    }
    if (agreedToTerms) createOrder()
    return () => {
      creatingRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agreedToTerms])

  // ── Resume payment after page refresh ─────────────────────────────────────
  // When the component mounts with resumeBookingId (persisted via sessionStorage),
  // we poll the booking status immediately to pick up where the user left off.
  // If the order already has a provider_order_no, the status endpoint will return
  // the current state (pending / pending_confirmation / success / etc.).
  // If not, we trigger a Mode B createOrder to re-create the KPay order against
  // the existing booking.
  useEffect(() => {
    if (!resumeBookingId) return
    let cancelled = false

    const resumePayment = async () => {
      try {
        // First: poll status to see where the booking stands
        const statusRes = await fetch(`/api/checkout/status?bookingId=${resumeBookingId}`)
        if (!statusRes.ok || cancelled) return
        const status = await statusRes.json() as Record<string, unknown>

        if (cancelled) return

        const uiStatus = status.status as string | undefined
        const providerOrderNoVal = status.providerOrderNo as string | undefined

        // Booking is already confirmed — nothing to do, onSuccess will fire from the polling effect
        if (uiStatus === 'confirmed') {
          setState('success')
          return
        }

        // Booking terminal state (cancelled, expired, payment_failed)
        if (uiStatus === 'cancelled' || uiStatus === 'expired') {
          setState(uiStatus as KPayState)
          return
        }

        if (uiStatus === 'payment_failed') {
          const holdActive = status.holdActive as boolean | undefined
          setFailureReason(null)
          setState(holdActive ? 'failed' : 'cancelled')
          return
        }

        // If the order already has a provider_order_no, the existing polling
        // effect will pick up the status transitions — we just need to set
        // the providerOrderNo so the UI can show the QR code or pending screen.
        if (providerOrderNoVal) {
          setProviderOrderNo(providerOrderNoVal)
          setPayInfo((status.payInfo as string) ?? null)
          setKind((status.kind as string) ?? null)
          setExpiresIn((status.expiresInSeconds as number) ?? 0)
          setCountdown((status.expiresInSeconds as number) ?? 0)
          setState(uiStatus === 'pending_confirmation' ? 'pending_confirmation' : 'pending')
          return
        }

        // No provider order yet — create one via Mode B (existing bookingId)
        if (!agreedToTerms) return
        if (creatingRef.current) return
        creatingRef.current = true
        setCreating(true)
        setError(null)
        setFailureReason(null)

        const body: Record<string, unknown> = {
          method,
          mode,
          agreedToTerms,
          bookingId: resumeBookingId,
          orderGroupId: resumeOrderNo ? undefined : localOrderGroupId,
        }
        if (pointsAmount > 0) body.pointsAmount = pointsAmount
        // UAT-ONLY: include PayMe test simulation selector when present in URL
        if (uatPaymeSimulation) body.uat_payme = uatPaymeSimulation

        const createRes = await fetch('/api/checkout/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (!createRes.ok || cancelled) {
          const errBody = await createRes.json().catch(() => null) as Record<string, unknown> | null
          setError((errBody?.error as string) ?? '付款初始化失敗，請重試')
          setState('failed')
          return
        }

        const json = await createRes.json() as Record<string, unknown>

        // Redirect responses — same as createOrder
        if ((json.kind === 'redirect' || json.kind === 'link') && json.payInfo) {
          if (/^(https?:\/\/|[a-z][a-z0-9+.-]*:)/i.test(String(json.payInfo).trim())) {
            window.location.href = String(json.payInfo)
            return
          }
          setError('付款閘道回應格式錯誤，請重試或改用其他付款方式')
          setState('failed')
          return
        }

        setProviderOrderNo(json.providerOrderNo as string)
        setPayInfo(json.payInfo as string)
        setKind(json.kind as string)
        setExpiresIn(json.expiresInSeconds as number)
        setCountdown(json.expiresInSeconds as number)
        if (json.bookingId) setLocalBookingId(String(json.bookingId))
        if (json.orderGroupId) setLocalOrderGroupId(String(json.orderGroupId))
        setState('pending')

        // Persist for future refreshes
        persistKPayState({
          bookingId: String(json.bookingId ?? resumeBookingId),
          providerOrderNo: json.providerOrderNo as string,
          method,
          mode,
          agreedToTerms: true,
          savedAt: Date.now(),
        })

        if (json.kind === 'form-post') {
          if (!submitGatewayForm(json.payInfo as string)) {
            setError('付款閘道回應格式錯誤，請重試或改用其他付款方式')
            setState('failed')
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message)
          setState('failed')
        }
      } finally {
        creatingRef.current = false
        setCreating(false)
      }
    }

    resumePayment()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeBookingId])

  // ── Countdown timer ────────────────────────────────────────────────────────

  useEffect(() => {
    if (state !== 'pending') {
      if (countdownRef.current) clearInterval(countdownRef.current)
      return
    }

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!)
          // Expired — auto-regenerate
          setState('expired')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [state])

  // ── Poll for status ────────────────────────────────────────────────────────

  useEffect(() => {
    if (stateRef.current !== 'pending' && stateRef.current !== 'pending_confirmation') {
      return
    }

    if (!localBookingId) return

    pollStartRef.current = Date.now()
    console.log('[KPay] pollStart', { bookingId: localBookingId })

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let elapsedTimer: ReturnType<typeof setInterval> | null = null

    // Smooth per-second "已等待 XX 秒" counter, independent of poll cadence.
    elapsedTimer = setInterval(() => {
      if (cancelled) return
      setElapsedSec(Math.floor((Date.now() - pollStartRef.current) / 1000))
    }, 1_000)

    const poll = async () => {
      if (cancelled) return
      const attempt = attemptRef.current
      const elapsedMs = Date.now() - pollStartRef.current

      try {
        const res = await fetch(`/api/checkout/status?bookingId=${encodeURIComponent(localBookingId)}`, { cache: 'no-store' })
        const raw: unknown = await res.json()
        if (!res.ok || attempt !== attemptRef.current) return
        const json = raw && typeof raw === 'object' && !Array.isArray(raw)
          ? raw as Record<string, unknown>
          : {}
        const status = typeof json.status === 'string' ? json.status : undefined
        const providerStatus = typeof json.providerStatus === 'string' ? json.providerStatus : undefined
        const reason = typeof json.failureReason === 'string' ? json.failureReason : undefined
        const code = typeof json.failureCode === 'string' ? json.failureCode : undefined

        console.log('[KPay] pollResult', {
          bookingId: localBookingId,
          elapsedMs,
          status,
          providerStatus,
        })

        if (reason || code) setFailureReason([code, reason].filter(Boolean).join(' · '))
        if (status === 'confirmed') {
          console.log('[KPay] pollResult confirmed', { bookingId: localBookingId, elapsedMs })
          clearKPayPersistedState()
          setState('success')
          onSuccessRef.current(localBookingId)
          return
        }
        if (status === 'pending_confirmation' || providerStatus === 'success') {
          setState('pending_confirmation')
        } else if (status === 'expired' || providerStatus === 'expired') {
          console.log('[KPay] pollResult expired', { bookingId: localBookingId, elapsedMs })
          clearKPayPersistedState()
          setState('expired')
          return
        } else if (status === 'cancelled' || providerStatus === 'cancelled') {
          console.log('[KPay] pollResult cancelled', { bookingId: localBookingId, elapsedMs })
          clearKPayPersistedState()
          setState('cancelled')
          return
        } else if (status === 'failed' || status === 'payment_failed' || providerStatus === 'failed' || providerStatus === 'closed') {
          console.log('[KPay] pollResult failed', { bookingId: localBookingId, elapsedMs, status, providerStatus })
          setState('failed')
          return
        }
      } catch {
        // Network error — retry on the next interval.
      }

      if (cancelled) return
      // Timeout fallback: if we've been polling longer than KPAY_POLL_TIMEOUT_MS,
      // stop and transition to a terminal state so the UI isn't stuck forever.
      if (elapsedMs >= KPAY_POLL_TIMEOUT_MS) {
        console.log('[KPay] pollTimeout', { bookingId: localBookingId, elapsedMs })
        // If the last response showed provider success but DB isn't confirmed
        // yet, stay on pending_confirmation (the status endpoint is proactively
        // confirming — one more poll will likely resolve it). Otherwise, treat
        // as a failure so the user can take action.
        if (stateRef.current === 'pending_confirmation') {
          // Keep polling slowly — proactive confirmation may still be in progress
          timer = setTimeout(poll, KPAY_POLL_SLOW_MS)
          return
        }
        clearKPayPersistedState()
        setState('failed')
        return
      }
      // Fast 2 s for the first 30 s (webhooks are near-instant), then back off.
      const interval = elapsedMs < KPAY_POLL_FAST_PHASE_MS ? KPAY_POLL_FAST_MS : KPAY_POLL_SLOW_MS
      timer = setTimeout(poll, interval)
    }

    void poll()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      if (elapsedTimer) clearInterval(elapsedTimer)
    }
  }, [localBookingId])

  // ── Retry the current booking after an expired or failed provider attempt ──

  const formatCountdown = (seconds: number): string => {
    if (seconds >= 60) {
      const minutes = Math.floor(seconds / 60)
      const remainder = seconds % 60
      return remainder === 0 ? `${minutes} 分鐘` : `${minutes} 分 ${remainder} 秒`
    }
    return `${seconds} 秒`
  }

  const isUrgent = countdown <= 60

  // ── State screens ──────────────────────────────────────────────────────────

  if (!agreedToTerms) {
    return (
      <div style={styles.card}>
        <p style={styles.stateTitle}>{labels.terms_required}</p>
      </div>
    )
  }

  if (state === 'success') {
    return (
      <div style={styles.card}>
        <div style={styles.iconWrap}>
          <CircleCheck size={48} color={GREEN_BRIGHT} aria-hidden />
        </div>
        <p style={styles.stateTitle}>{labels.success}</p>
        <p style={styles.stateDesc}>{labels.success_desc}</p>
      </div>
    )
  }

  if (state === 'pending_confirmation') {
    return (
      <div style={styles.card}>
        <div style={styles.spinner} />
        <p style={styles.stateTitle}>{labels.pending_confirmation}</p>
        <p style={styles.stateDesc}>{labels.pending_confirmation_desc}</p>
        {elapsedSec > 0 && (
          <p style={styles.elapsedText}>{labels.waited.replace('{seconds}', String(elapsedSec))}</p>
        )}
      </div>
    )
  }

  if (state === 'failed') {
    return (
      <div style={styles.card}>
        <div style={styles.iconWrap}>
          <CircleX size={48} color={DANGER} aria-hidden />
        </div>
        <p style={styles.stateTitle}>{labels.failed}</p>
        <p style={styles.stateDesc}>
          {error || labels.failed_desc}
        </p>
        {failureReason && <p style={styles.failureReason}>{failureReason}</p>}
        <button type="button" onClick={retryPayment} disabled={actionBusy} style={styles.primaryButton}>
          {actionBusy ? labels.processing : labels.try_again}
        </button>
        <button type="button" onClick={onBackToMethods} disabled={actionBusy} style={styles.secondaryButton}>
          {labels.back_to_methods}
        </button>
        <button type="button" onClick={cancelBooking} disabled={actionBusy} style={styles.tertiaryButton}>
          {labels.cancel}
        </button>
      </div>
    )
  }

  if (state === 'cancelled') {
    return (
      <div style={styles.card}>
        <div style={styles.iconWrap}>
          <CircleX size={48} color={TEXT_FAINT} aria-hidden />
        </div>
        <p style={styles.stateTitle}>{labels.cancelled}</p>
        <p style={styles.stateDesc}>{labels.cancelled_desc}</p>
        <button type="button" onClick={onBackToMethods} style={styles.primaryButton}>
          {labels.back_to_methods}
        </button>
      </div>
    )
  }

  if (state === 'expired') {
    return (
      <div style={styles.card}>
        <div style={styles.iconWrap}>
          <Clock3 size={48} color={TEXT_FAINT} aria-hidden />
        </div>
        <p style={styles.stateTitle}>{labels.expired}</p>
        <p style={styles.stateDesc}>{labels.expired_desc}</p>
        <button type="button" onClick={retryPayment} disabled={actionBusy} style={styles.primaryButton}>
          {actionBusy ? labels.processing : labels.regenerate}
        </button>
        <button type="button" onClick={onBackToMethods} disabled={actionBusy} style={styles.secondaryButton}>
          {labels.back_to_methods}
        </button>
        <button
          type="button"
          onClick={cancelBooking}
          disabled={actionBusy}
          style={styles.tertiaryButton}
        >
          {labels.cancel}
        </button>
      </div>
    )
  }

  // ── Pending (QR/H5) or idle/creating ───────────────────────────────────────

  if (state === 'idle' || creating) {
    return (
      <div style={styles.card}>
        <div style={styles.spinner} />
        <p style={styles.stateTitle}>{labels.processing}</p>
      </div>
    )
  }

  // QR payload — the server-decided kind is authoritative. In particular,
  // card/CNP Hosted may be requested with desktop mode "qr" but returns a
  // redirect URL and must never render the QR screen.
  if (kind === 'qr' && payInfo) {
    return (
      <div style={styles.card}>
        <p style={styles.qrTitle}>
          {labels.pending.replace('{method}', METHOD_NAMES[method])}
        </p>

        <div style={styles.qrWrap}>
          <QRCodeSVG
            value={payInfo}
            size={240}
            bgColor={BG}
            fgColor={TEXT}
            level="M"
            style={styles.qr}
          />
        </div>

        <p style={styles.countdownText}>
          {labels.countdown.replace('{time}', formatCountdown(countdown))}
        </p>

        {elapsedSec > 0 && (
          <p style={styles.elapsedText}>
            {labels.waited.replace('{seconds}', String(elapsedSec))}
          </p>
        )}

        {/* Countdown bar */}
        <div style={styles.countdownBarBg}>
          <div
            style={{
              ...styles.countdownBarFill,
              transform: `scaleX(${countdown / expiresIn})`,
              background: isUrgent ? DANGER : GREEN_BRIGHT,
              transition: `transform 1s linear, background 0.3s ease`,
            }}
          />
        </div>

        <p style={styles.stateDesc}>
          {labels.pending_desc.replace('{time}', formatCountdown(countdown))}
        </p>

        {/* ── UAT-ONLY: PayMe simulation toggle ──────────────────────────── */}
        {method === 'payme' && (
          <div style={styles.uatToggleWrap}>
            <span style={styles.uatLabel}>UAT 模擬</span>
            <div style={styles.uatToggle}>
              <button
                type="button"
                onClick={() => setUatPaymeSimulation('success')}
                style={{
                  ...styles.uatToggleBtn,
                  ...(uatPaymeSimulation === 'success' || (!uatPaymeSimulation && true)
                    ? styles.uatToggleBtnActiveSuccess
                    : {}),
                }}
              >
                成功 8.81
              </button>
              <button
                type="button"
                onClick={() => setUatPaymeSimulation('fail')}
                style={{
                  ...styles.uatToggleBtn,
                  ...(uatPaymeSimulation === 'fail' ? styles.uatToggleBtnActiveFail : {}),
                }}
              >
                失敗 8.82
              </button>
            </div>
          </div>
        )}
        {/* ───────────────────────────────────────────────────────────────── */}

        <p style={styles.helpText}>
          {labels.help}
          {' · '}
          <a
            href="https://wa.me/852"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.helpLink}
          >
            {labels.support_whatsapp}
          </a>
        </p>

        <button type="button" onClick={onBackToMethods} disabled={actionBusy} style={styles.secondaryButton}>
          {labels.back_to_methods}
        </button>

        <button
          type="button"
          onClick={cancelBooking}
          disabled={actionBusy}
          style={styles.tertiaryButton}
        >
          {labels.cancel}
        </button>
      </div>
    )
  }

  // H5 mode (should redirect, but show a fallback)
  return (
    <div style={styles.card}>
      <div style={styles.spinner} />
      <p style={styles.stateTitle}>
        {labels.pending.replace('{method}', METHOD_NAMES[method])}
      </p>
      <p style={styles.stateDesc}>{labels.pending_desc}</p>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: SURFACE,
    border: `1px solid ${BORDER}`,
    borderRadius: 20,
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    animation: `entrance ${EASE_SPRING} 300ms`,
  },
  iconWrap: {
    width: 64,
    height: 64,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stateTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: TEXT,
    margin: 0,
    textAlign: 'center',
  },
  stateDesc: {
    fontSize: 14,
    color: TEXT_MUTED,
    margin: 0,
    textAlign: 'center',
    lineHeight: 1.6,
    maxWidth: 280,
  },
  failureReason: {
    fontSize: 12,
    color: TEXT_FAINT,
    margin: 0,
    textAlign: 'center',
    lineHeight: 1.5,
    maxWidth: 280,
  },
  qrTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: TEXT,
    margin: 0,
    textAlign: 'center',
    marginBottom: 8,
  },
  qrWrap: {
    padding: 16,
    background: BG,
    borderRadius: 16,
    border: `1px solid ${BORDER}`,
  },
  qr: {
    display: 'block',
    width: 240,
    height: 240,
  },
  countdownText: {
    fontSize: 14,
    fontWeight: 600,
    color: TEXT,
    margin: '8px 0 0',
    fontVariantNumeric: 'tabular-nums',
  },
  elapsedText: {
    fontSize: 12,
    color: TEXT_FAINT,
    margin: '4px 0 0',
    fontVariantNumeric: 'tabular-nums',
  },
  countdownBarBg: {
    width: 240,
    height: 4,
    background: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  countdownBarFill: {
    height: '100%',
    width: '100%',
    borderRadius: 2,
    transformOrigin: 'left',
  },
  helpText: {
    fontSize: 12,
    color: TEXT_FAINT,
    margin: 0,
    textAlign: 'center',
    marginTop: 8,
  },
  helpLink: {
    color: GREEN_BRIGHT,
    textDecoration: 'underline',
    textUnderlineOffset: 3,
  },
  primaryButton: {
    minHeight: 44,
    padding: '0 28px',
    border: 'none',
    borderRadius: 14,
    background: GREEN_BRIGHT,
    color: BG,
    fontWeight: 700,
    fontSize: 15,
    cursor: 'pointer',
    width: '100%',
    maxWidth: 280,
    animation: `entrance ${EASE_STANDARD} 250ms`,
  },
  secondaryButton: {
    minHeight: 44,
    padding: '0 28px',
    border: `1px solid ${BORDER}`,
    borderRadius: 14,
    background: 'transparent',
    color: TEXT_MUTED,
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    width: '100%',
    maxWidth: 280,
  },
  tertiaryButton: {
    minHeight: 44,
    padding: '0 28px',
    border: 'none',
    borderRadius: 14,
    background: 'transparent',
    color: TEXT_FAINT,
    fontWeight: 500,
    fontSize: 13,
    cursor: 'pointer',
    width: '100%',
    maxWidth: 280,
  },
  spinner: {
    width: 40,
    height: 40,
    border: `3px solid ${BORDER}`,
    borderTopColor: GREEN_BRIGHT,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginBottom: 8,
  },

  // ── UAT-ONLY PayMe simulation toggle ──────────────────────────────────────
  uatToggleWrap: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    marginBottom: 4,
  },
  uatLabel: {
    fontSize: 11,
    color: '#888',
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
  },
  uatToggle: {
    display: 'flex',
    borderRadius: 6,
    overflow: 'hidden',
    border: `1px solid ${BORDER}`,
  },
  uatToggleBtn: {
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    background: '#1a1a1a',
    color: '#666',
    border: 'none',
    transition: 'all 0.15s ease',
  },
  uatToggleBtnActiveSuccess: {
    background: GREEN_BRIGHT,
    color: '#000',
  },
  uatToggleBtnActiveFail: {
    background: '#e74c3c',
    color: '#fff',
  },
}