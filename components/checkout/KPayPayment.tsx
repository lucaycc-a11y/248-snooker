"use client"

import { PaymentSupportLink } from '@/components/checkout/PaymentSupportLink'
import { fetchFreezeActive, stashGatewayHandoff, submitGatewayForm } from '@/lib/checkout/gateway-handoff'
import { checkoutErrorText } from '@/lib/checkout/error-text'
import { useEffect, useRef, useState, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { CircleCheck, CircleX, Clock3 } from 'lucide-react'
import { tokens } from '@/app/styles/tokens'
import { isProductionEnv } from '@/lib/env/app-env'

// ── Types ────────────────────────────────────────────────────────────────────

// Same locale-prefix rule the create-order flow uses for the gateway return URL.
function confirmPathFor(bookingId: string): string {
  const localePrefix = window.location.pathname.match(/^\/(zh-HK|zh-CN|en|ja)(?=\/|$)/)?.[1]
  // The real status screen lives on /book (the /book/confirm route only redirects here).
  return `${localePrefix ? `/${localePrefix}` : ''}/book?bookingId=${encodeURIComponent(bookingId)}&redirect_status=returned`
}

export type KPayMethod = 'card' | 'fps' | 'payme' | 'octopus' | 'alipay' | 'alipayhk' | 'wechat' | 'unionpay_qp'

export type KPayState =
  | 'idle'          // initial — not yet created
  | 'pending'       // QR/H5 shown, awaiting customer payment
  | 'pending_confirmation' // provider succeeded, DB confirmation is pending
  | 'success'       // payment confirmed
  | 'failed'        // payment failed
  | 'cancelled'     // booking hold was cancelled
  | 'expired'       // QR/H5 link expired
  | 'unauthorized'  // session expired (401)

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

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
  /** Optional so existing callers keep compiling; fall back to Traditional Chinese. */
  err_init?: string
  err_unauthorized?: string
  err_slot_taken?: string
  err_price_changed?: string
  reselect_slot?: string
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
  /** Whether Space Wallet discount is applied (server re-validates) */
  useWallet?: boolean
  /** Promo code to apply (server re-validates) */
  promoCode?: string | null
  /** Expected total after all discounts — validated server-side */
  expectedTotal?: number
  /** Resume an in-progress payment after page refresh — skip order creation and
   * restore the existing bookingId/orderNo directly. */
  resumeBookingId?: string
  resumeOrderNo?: string
  /**
   * UAT-only PayMe simulation mode, set by the parent pre-checkout modal.
   * When provided, overrides the URL-param fallback.
   */
  uatPaymeSimulation?: 'success' | 'fail'
  /**
   * Where to create the order. Omit for the public endpoint — that is the
   * exact previous behaviour. Admin KPay mode passes the admin route so the
   * booking is stamped `is_test` server-side instead of hostname-derived.
   * Only order CREATION is redirected; status / cancel / retry stay shared.
   */
  createEndpoint?: string
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
const SURFACE = '#2a2c30'
const TEXT = '#ffffff'
// QR tile polarity. Must stay DARK modules on a LIGHT tile: payment-app
// scanners look for dark-on-light and will not invert, so a white-on-black QR
// renders fine on screen and is still unscannable. Verified in
// _perf/qr-decode-check.mjs (inverted fails strict decode; auto-invert passes).
const QR_TILE_BG = '#ffffff'
const QR_TILE_FG = '#000000'
// <= 12% of the QR size (240px) so the excavated hole stays well inside the
// level="Q" (25%) recovery budget. 26/240 = 10.8%.
const QR_LOGO_PX = 26
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
/** Hard ceiling: keep polling for as long as KPay itself keeps the order payable,
 *  plus a short grace period. KPay fixes FPS QR orders at 5 minutes and other QR /
 *  H5 orders at 10 minutes (orderExpire docs). Stopping earlier showed "failed"
 *  while the QR could still be paid, so a customer could retry and then pay the
 *  old QR, leaving a paid order that no longer matched its booking. */
function kpayPollTimeoutMs(method: KPayMethod): number {
  return (method === 'fps' ? 5 * 60_000 : 10 * 60_000) + 15_000
}

// ── Component ────────────────────────────────────────────────────────────────

export default function KPayPayment(props: Props) {
  const {
    blocks, bookingId, orderGroupId, method, mode, labels, agreedToTerms,
    resumeBookingId, resumeOrderNo, onBackToMethods, onSuccess,
  } = props
  const useWallet = props.useWallet ?? false
  const promoCode = props.promoCode ?? null
  const expectedTotal = props.expectedTotal
  // Defaults to the public create route. Passing a different endpoint is the
  // only behavioural lever this component exposes to admin KPay mode.
  const createEndpoint = props.createEndpoint ?? '/api/checkout/create'

  // ── UAT-ONLY PayMe test simulation selector ───────────────────────────────
  // Prefer the parent prop (from pre-checkout modal); fall back to URL param.
  // The toggle UI lets the tester switch modes without editing the URL.
  // Server-side: only applies when KPAY_ENV !== 'prod' AND method === 'payme'.
  const [uatPaymeSimulation, setUatPaymeSimulation] = useState<'success' | 'fail' | undefined>(() => {
    // Parent prop takes priority
    if (props.uatPaymeSimulation) return props.uatPaymeSimulation
    // URL param fallback
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
  const createControllerRef = useRef<AbortController | null>(null)

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
      const localePrefix = window.location.pathname.match(/^\/(zh-HK|zh-CN|en|ja)(?=\/|$)/)?.[1]
      const confirmPath = `${localePrefix ? `/${localePrefix}` : ''}/book/confirm`
      const body: Record<string, unknown> = {
        method,
        mode,
        agreedToTerms,
        returnUrl: `${window.location.origin}${confirmPath}`,
      }
      if (useWallet) body.useWallet = true
      if (promoCode) body.promoCode = promoCode
      // Total the UI is currently showing. Advisory only — the server
      // recomputes the real total and 409s on mismatch before any gateway call.
      if (typeof expectedTotal === 'number') body.expectedTotal = expectedTotal
      // UAT-ONLY: include PayMe test simulation selector when present in URL
      if (uatPaymeSimulation) {
        body.uat_payme = uatPaymeSimulation
        console.log('[KPay] createOrder sending uat_payme:', uatPaymeSimulation, '| amount before server adjust:', body.amount)
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

      const controller = new AbortController()
      createControllerRef.current = controller
      const res = await fetch(createEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!res.ok) {
        let message = labels.err_init ?? '付款初始化失敗，請重試。'
        let errorType: 'unauthorized' | 'slot_unavailable' | 'price_changed' | 'generic' = 'generic'
        try {
          const errBody = await res.json()
          const errorText = errBody.error || message

          // Part 2: Detect session expiry (401 Unauthorized)
          if (res.status === 401) {
            message = labels.err_unauthorized ?? '登入已過期，請重新登入。'
            errorType = 'unauthorized'
          }
          // Part 3: Detect slot unavailability (409 Conflict)
          else if (errBody.code === 'price_changed' || errorText === 'price_changed') {
            message = labels.err_price_changed ?? '金額已更新，請返回選擇付款方式重新確認。'
            errorType = 'price_changed'
            // The server hands back the stale booking it adopted so "back" can
            // release it (leaveAndRelease -> /api/checkout/cancel). Without this
            // the booking stays pending with its old discount selection and the
            // next attempt re-adopts it and 409s again, forever.
            if (typeof errBody.bookingId === 'string') setLocalBookingId(errBody.bookingId)
            if (typeof errBody.orderGroupId === 'string') setLocalOrderGroupId(errBody.orderGroupId)
          }
          else if (errorText.includes('Slot unavailable') ||
                   errorText.includes('Slot lock no longer valid') ||
                   errBody.reason === 'slot_confirmed') {
            message = labels.err_slot_taken ?? '此時段已被預訂，請重新選擇時段。'
            errorType = 'slot_unavailable'
          }
          else {
            message = checkoutErrorText(errorText)
          }
        } catch {
          // non-JSON response (e.g. unexpected HTML error page) — use default
        }
        setError(message)
        setState(errorType === 'unauthorized' ? 'unauthorized' as KPayState : 'failed')
        // Store error type for rendering appropriate CTA in the failed state screen
        if (errorType === 'slot_unavailable' || errorType === 'price_changed') {
          setFailureReason(errorType)
        } else {
          setFailureReason(null)
        }
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
        if (json.bookingId || localBookingId) {
          const bookingId = String(json.bookingId ?? localBookingId)
          // Confirm-page-first: go to /book/confirm and let THAT page open the gateway,
          // so Back / the gateway's return link always lands on the confirm page.
          if (await fetchFreezeActive()) {
            try {
              persistKPayState({
                bookingId,
                providerOrderNo: json.providerOrderNo,
                method,
                mode,
                agreedToTerms: true,
                savedAt: Date.now(),
              })
            } catch {}
            if (stashGatewayHandoff({ bookingId, kind: 'redirect', payInfo: String(json.payInfo) })) {
              window.location.assign(confirmPathFor(bookingId))
              return
            }
          }
          const localePrefix = window.location.pathname.match(/^\/(zh-HK|zh-CN|en|ja)(?=\/|$)/)?.[1]
          const confirmUrl = `${window.location.origin}${localePrefix ? `/${localePrefix}` : ''}/book/confirm?bookingId=${encodeURIComponent(bookingId)}`
          window.history.replaceState({}, '', confirmUrl)
          try {
            persistKPayState({
              bookingId: String(json.bookingId ?? localBookingId),
              providerOrderNo: json.providerOrderNo,
              method,
              mode,
              agreedToTerms: true,
              savedAt: Date.now(),
            })
          } catch {}
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
        const bookingId = String(json.bookingId ?? localBookingId)
        if (await fetchFreezeActive() && stashGatewayHandoff({ bookingId, kind: 'form-post', payInfo: String(json.payInfo) })) {
          window.location.assign(confirmPathFor(bookingId))
          return
        }
        const localePrefix = window.location.pathname.match(/^\/(zh-HK|zh-CN|en|ja)(?=\/|$)/)?.[1]
        const confirmUrl = `${window.location.origin}${localePrefix ? `/${localePrefix}` : ''}/book/confirm?bookingId=${encodeURIComponent(bookingId)}`
        window.history.replaceState({}, '', confirmUrl)
        if (!submitGatewayForm(json.payInfo)) {
          setError('付款閘道回應格式錯誤，請重試或改用其他付款方式')
          setState('failed')
        }
        return
      }
    } catch (e) {
      if (!isAbortError(e)) {
        setError((e as Error).message)
        setState('failed')
      }
    } finally {
      creatingRef.current = false
      setCreating(false)
    }
  }, [agreedToTerms, blocks, createEndpoint, localBookingId, localOrderGroupId, method, mode, useWallet, promoCode, uatPaymeSimulation])

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
        if (message === 'payment_received') {
          window.location.href = confirmPathFor(localBookingId)
          return
        }
        setError(typeof message === 'string' ? checkoutErrorText(message) : labels.cancelled_desc)
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

  // Leaving the QR / payment screen via "back" must not leave the booking pending:
  // a pending booking keeps the slot and the wallet credits held for ~10-15 minutes,
  // which is what made the next attempt fail with "slot taken" / insufficient credits.
  // Release it in the background (never block the user on the network) and go back
  // at once. cancel_pending_booking only cancels bookings that are still pending, so
  // a booking that has already been paid/confirmed is left alone by the server.
  const leaveAndRelease = useCallback(() => {
    if (actionBusy) return
    if (localBookingId) {
      attemptRef.current += 1 // drop any in-flight poll result for the abandoned attempt
      if (countdownRef.current) clearInterval(countdownRef.current)
      void fetch('/api/checkout/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: localBookingId }),
        keepalive: true,
      }).catch(() => {})
    }
    onBackToMethods()
  }, [actionBusy, localBookingId, onBackToMethods])

  const retryPayment = useCallback(async () => {
    if (actionBusy || !localBookingId) return
    setActionBusy(true)
    setError(null)
    try {
      // Release the failed/expired attempt (booking -> cancelled, slot + credits
      // freed) instead of resetting it to `pending`: the client drops this booking
      // id when it returns to the method picker, so a reset booking was orphaned
      // and kept the slot locked for other members until the hold timed out. The
      // fresh method selection mints a new booking and re-locks the slot.
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
        // KPay still has a live or paid order: never pretend the payment failed and
        // never release anything. Paid -> the confirm page finishes it; in progress ->
        // stay here with an honest message.
        if (message === 'payment_received') {
          window.location.href = confirmPathFor(localBookingId)
          return
        }
        if (message === 'payment_in_progress') {
          setError(checkoutErrorText(message))
          return
        }
        setError(typeof message === 'string' ? checkoutErrorText(message) : labels.failed_desc)
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
      createControllerRef.current?.abort()
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
    let activeController: AbortController | null = null

    const resumePayment = async () => {
      try {
        // First: poll status to see where the booking stands
        activeController = new AbortController()
        const statusRes = await fetch(`/api/checkout/status?bookingId=${resumeBookingId}`, {
          signal: activeController.signal,
        })
        if (!statusRes.ok || cancelled) return
        const status = await statusRes.json() as Record<string, unknown>

        if (cancelled) return

        const uiStatus = status.status as string | undefined
        const providerOrderNoVal = status.providerOrderNo as string | undefined

        // Booking is already confirmed — trigger onSuccess directly
        // (the polling effect won't run because we're not in pending/pending_confirmation state)
        if (uiStatus === 'confirmed') {
          clearKPayPersistedState()
          setState('success')
          onSuccessRef.current(localBookingId)
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

        const localePrefix = window.location.pathname.match(/^\/(zh-HK|zh-CN|en|ja)(?=\/|$)/)?.[1]
        const confirmPath = `${localePrefix ? `/${localePrefix}` : ''}/book/confirm`
        const body: Record<string, unknown> = {
          method,
          mode,
          agreedToTerms,
          returnUrl: `${window.location.origin}${confirmPath}`,
          bookingId: resumeBookingId,
          orderGroupId: resumeOrderNo ? undefined : localOrderGroupId,
        }
        if (useWallet) body.useWallet = true
        if (promoCode) body.promoCode = promoCode
        if (typeof expectedTotal === 'number') body.expectedTotal = expectedTotal
        // UAT-ONLY: include PayMe test simulation selector when present in URL
        if (uatPaymeSimulation) {
          body.uat_payme = uatPaymeSimulation
          console.log('[KPay] createOrder (Mode B) sending uat_payme:', uatPaymeSimulation)
        }

        activeController = new AbortController()
        const createRes = await fetch(createEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: activeController.signal,
        })

        if (!createRes.ok || cancelled) {
          const errBody = await createRes.json().catch(() => null) as Record<string, unknown> | null
          setError(typeof errBody?.error === 'string' ? checkoutErrorText(errBody.error) : '付款初始化失敗，請重試')
          setState('failed')
          return
        }

        const json = await createRes.json() as Record<string, unknown>

        // Redirect responses — same as createOrder
        if ((json.kind === 'redirect' || json.kind === 'link') && json.payInfo) {
          if (/^(https?:\/\/|[a-z][a-z0-9+.-]*:)/i.test(String(json.payInfo).trim())) {
            const bookingId = String(json.bookingId ?? resumeBookingId)
            const localePrefix = window.location.pathname.match(/^\/(zh-HK|zh-CN|en|ja)(?=\/|$)/)?.[1]
            const confirmUrl = `${window.location.origin}${localePrefix ? `/${localePrefix}` : ''}/book/confirm?bookingId=${encodeURIComponent(bookingId)}`
            window.history.replaceState({}, '', confirmUrl)
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
          const bookingId = String(json.bookingId ?? resumeBookingId)
          const localePrefix = window.location.pathname.match(/^\/(zh-HK|zh-CN|en|ja)(?=\/|$)/)?.[1]
          const confirmUrl = `${window.location.origin}${localePrefix ? `/${localePrefix}` : ''}/book/confirm?bookingId=${encodeURIComponent(bookingId)}`
          window.history.replaceState({}, '', confirmUrl)
          if (!submitGatewayForm(json.payInfo as string)) {
            setError('付款閘道回應格式錯誤，請重試或改用其他付款方式')
            setState('failed')
          }
        }
      } catch (e) {
        if (!cancelled && !isAbortError(e)) {
          setError((e as Error).message)
          setState('failed')
        }
      } finally {
        creatingRef.current = false
        setCreating(false)
      }
    }

    void resumePayment()
    return () => {
      cancelled = true
      activeController?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createEndpoint, resumeBookingId])

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
    let activeController: AbortController | null = null

    // Smooth per-second "已等待 XX 秒" counter, independent of poll cadence.
    elapsedTimer = setInterval(() => {
      if (cancelled) return
      setElapsedSec(Math.floor((Date.now() - pollStartRef.current) / 1000))
    }, 1_000)

    const poll = async () => {
      if (cancelled) return
      const attempt = attemptRef.current
      const elapsedMs = Date.now() - pollStartRef.current

      const controller = new AbortController()
      activeController = controller

      try {
        const res = await fetch(`/api/checkout/status?bookingId=${encodeURIComponent(localBookingId)}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
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
        // Network error — retry on the next interval. Aborts are ignored below.
      } finally {
        if (activeController === controller) activeController = null
      }

      if (cancelled) return
      // Timeout fallback: if we've been polling longer than KPay keeps the order payable,
      // stop and transition to a terminal state so the UI isn't stuck forever.
      if (elapsedMs >= kpayPollTimeoutMs(method)) {
        console.log('[KPay] pollTimeout', { bookingId: localBookingId, elapsedMs })
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
      activeController?.abort()
      if (timer) clearTimeout(timer)
      if (elapsedTimer) clearInterval(elapsedTimer)
    }
  }, [localBookingId, method])

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

  // Part 2: Unauthorized state (session expired)
  if (state === 'unauthorized') {
    return (
      <div style={styles.card}>
        <div style={styles.iconWrap}>
          <CircleX size={48} color={DANGER} aria-hidden />
        </div>
        <p style={styles.stateTitle}>登入已過期</p>
        <p style={styles.stateDesc}>
          {error || labels.err_unauthorized || '登入已過期，請重新登入。'}
        </p>
        <button
          type="button"
          onClick={() => {
            // Preserve current booking context for return after login
            const localePrefix = window.location.pathname.match(/^\/(zh-HK|zh-CN|en|ja)(?=\/|$)/)?.[1]
            const loginPath = `${localePrefix ? `/${localePrefix}` : ''}/login`
            const returnUrl = encodeURIComponent(window.location.pathname + window.location.search)
            window.location.href = `${loginPath}?returnUrl=${returnUrl}`
          }}
          style={styles.primaryButton}
        >
          返回登入
        </button>
      </div>
    )
  }

  if (state === 'failed') {
    // Part 3: Slot unavailability requires different CTA
    const isSlotUnavailable = failureReason === 'slot_unavailable'
    const isPriceChanged = failureReason === 'price_changed'

    return (
      <div style={styles.card}>
        <div style={styles.iconWrap}>
          <CircleX size={48} color={DANGER} aria-hidden />
        </div>
        <p style={styles.stateTitle}>{labels.failed}</p>
        <p style={styles.stateDesc}>
          {error || labels.failed_desc}
        </p>

        {isSlotUnavailable ? (
          // Slot unavailable: redirect to re-select time slots
          <>
            <button
              type="button"
              onClick={() => {
                // Clear the failed booking and return to booking page
                const localePrefix = window.location.pathname.match(/^\/(zh-HK|zh-CN|en|ja)(?=\/|$)/)?.[1]
                const bookPath = `${localePrefix ? `/${localePrefix}` : ''}/book`
                window.location.href = bookPath
              }}
              disabled={actionBusy}
              style={styles.primaryButton}
            >
              {labels.reselect_slot ?? '重新選擇時段'}
            </button>
            <button type="button" onClick={leaveAndRelease} disabled={actionBusy} style={styles.secondaryButton}>
              {labels.back_to_methods}
            </button>
          </>
        ) : isPriceChanged ? (
          // Amount changed: a retry would hit the same mismatch — go back and re-confirm
          <>
            <button type="button" onClick={leaveAndRelease} disabled={actionBusy} style={styles.primaryButton}>
              {labels.back_to_methods}
            </button>
          </>
        ) : (
          // Generic payment failure: allow retry
          <>
            <button type="button" onClick={retryPayment} disabled={actionBusy} style={styles.primaryButton}>
              {actionBusy ? labels.processing : labels.try_again}
            </button>
            <button type="button" onClick={leaveAndRelease} disabled={actionBusy} style={styles.secondaryButton}>
              {labels.back_to_methods}
            </button>
            <button type="button" onClick={cancelBooking} disabled={actionBusy} style={styles.tertiaryButton}>
              {labels.cancel}
            </button>
          </>
        )}
        <PaymentSupportLink bookingRef={localBookingId ?? '-'} providerOrderNo={providerOrderNo} stateCode="UI_FAILED" />
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
        <PaymentSupportLink bookingRef={localBookingId ?? '-'} providerOrderNo={providerOrderNo} stateCode="UI_CANCELLED" />
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
        <button type="button" onClick={leaveAndRelease} disabled={actionBusy} style={styles.secondaryButton}>
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
        <PaymentSupportLink bookingRef={localBookingId ?? '-'} providerOrderNo={providerOrderNo} stateCode="UI_EXPIRED" />
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

        {/* Dark-on-light tile with a 4-module quiet zone (includeMargin).
            level="Q" because the excavated logo destroys modules — the logo is
            capped at ~11% of the tile so the hole stays inside that budget. */}
        <div style={styles.qrWrap}>
          <QRCodeSVG
            value={payInfo}
            size={240}
            bgColor={QR_TILE_BG}
            fgColor={QR_TILE_FG}
            level="Q"
            includeMargin
            {...(['alipayhk', 'payme'].includes(method) && {
              imageSettings: {
                src: method === 'alipayhk' ? '/icons/payment/alipayhk.png' : '/icons/payment/payme.png',
                height: QR_LOGO_PX,
                width: QR_LOGO_PX,
                excavate: true,
              },
            })}
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

        {/* ── UAT-ONLY: PayMe simulation toggle ────────────────────────────
            Hidden in production (space8.com.hk). The server also refuses
            `uat_payme` when KPAY_ENV is prod, but a visible 8.81/8.82 switch
            on a live checkout is still a support and trust hazard. */}
        {method === 'payme' && !isProductionEnv() && (
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

        <button type="button" onClick={leaveAndRelease} disabled={actionBusy} style={styles.secondaryButton}>
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
      <p style={styles.stateDesc}>
        {labels.pending_desc.replace('{time}', formatCountdown(countdown))}
      </p>
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
    // White rounded tile sitting on the dark card — scanners need a light
    // field around the modules, not just a light QR.
    padding: 16,
    background: QR_TILE_BG,
    borderRadius: 16,
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
    color: '#888', // ignore-value design-system-color — UAT-only testing UI
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
    color: '#666', // ignore-value design-system-color — UAT-only testing UI
    border: 'none',
    transition: 'all 0.15s ease',
  },
  uatToggleBtnActiveSuccess: {
    background: GREEN_BRIGHT,
    color: '#000',
  },
  uatToggleBtnActiveFail: {
    background: '#e74c3c', // ignore-value design-system-color — UAT-only testing UI
    color: '#fff',
  },
}