"use client"

import { useEffect, useRef, useState } from 'react'
import { CircleCheck, CircleX } from 'lucide-react'

export type GooglePayBlock = {
  date: string
  startHour: number
  duration: number
  tableNumber: 1 | 2
}

export type GooglePayLabels = {
  title: string
  processing: string
  success: string
  success_desc: string
  failed: string
  failed_desc: string
  try_again: string
  back_to_methods: string
  terms_required: string
}

type Props = {
  blocks: GooglePayBlock[]
  merchantId: string
  merchantName: string
  currencyCode: string
  countryCode: string
  labels: GooglePayLabels
  agreedToTerms: boolean
  onBackToMethods: () => void
  onSuccess: (bookingId?: string) => void
}

const GREEN_BRIGHT = '#22b86b'
const BG = '#000000'
const SURFACE = '#111111'
const TEXT = '#ffffff'
const TEXT_MUTED = 'rgba(255,255,255,0.72)'
const BORDER = 'rgba(255,255,255,0.1)'
const DANGER = '#FF453A'
const EASE_SPRING = 'cubic-bezier(.34,1.56,.64,1)'

type GPEnvironment = 'TEST' | 'PRODUCTION'

declare global {
  interface Window {
    google?: {
      payments: {
        api: {
          PaymentsClient: new (config: { environment: GPEnvironment }) => GPClient
        }
      }
    }
  }
}

type GPClient = {
  isReadyToPay: (req: unknown) => Promise<{ result: boolean }>
  loadPaymentData: (req: unknown) => Promise<{ paymentMethodData: { tokenizationData: { token: string } } }>
  createButton: (config: { onClick: () => void; buttonType?: string; buttonColor?: string }) => HTMLElement
}

type State = 'idle' | 'loading_sdk' | 'ready' | 'processing' | 'success' | 'failed' | 'unavailable'

export default function GooglePayPayment(props: Props) {
  const {
    blocks,
    merchantId,
    merchantName,
    currencyCode,
    countryCode,
    labels,
    agreedToTerms,
    onBackToMethods,
    onSuccess,
  } = props

  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState<string | null>(null)
  const buttonContainerRef = useRef<HTMLDivElement>(null)
  const clientRef = useRef<GPClient | null>(null)

  useEffect(() => {
    if (!agreedToTerms) return
    setState('loading_sdk')

    const existing = document.querySelector('script[src="https://pay.google.com/gp/p/js/pay.js"]')
    if (existing) {
      initClient()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://pay.google.com/gp/p/js/pay.js'
    script.async = true
    script.onload = () => initClient()
    script.onerror = () => setState('unavailable')
    document.head.appendChild(script)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agreedToTerms])

  async function initClient() {
    if (!window.google?.payments?.api?.PaymentsClient) {
      setState('unavailable')
      return
    }

    const env: GPEnvironment = process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'TEST'
    const client = new window.google.payments.api.PaymentsClient({ environment: env })
    clientRef.current = client

    try {
      const { result } = await client.isReadyToPay({
        apiVersion: 2,
        apiVersionMinor: 0,
        allowedPaymentMethods: [baseCardPaymentMethod()],
      })
      if (!result) { setState('unavailable'); return }
    } catch {
      setState('unavailable')
      return
    }

    setState('ready')

    if (buttonContainerRef.current) {
      const btn = client.createButton({
        onClick: handlePayClick,
        buttonType: 'pay',
        buttonColor: 'black',
      })
      buttonContainerRef.current.replaceChildren(btn)
    }
  }

  async function handlePayClick() {
    if (!agreedToTerms) { setError(labels.terms_required); return }
    if (!clientRef.current) return

    setState('processing')
    setError(null)

    const totalAmount = await fetchAmount()
    if (totalAmount === null) {
      setError(labels.failed_desc)
      setState('failed')
      return
    }

    let paymentData: Awaited<ReturnType<GPClient['loadPaymentData']>>
    try {
      paymentData = await clientRef.current.loadPaymentData({
        apiVersion: 2,
        apiVersionMinor: 0,
        allowedPaymentMethods: [cardPaymentMethod()],
        merchantInfo: { merchantId, merchantName },
        transactionInfo: {
          totalPriceStatus: 'FINAL',
          totalPrice: totalAmount,
          currencyCode,
          countryCode,
        },
      })
    } catch (e: unknown) {
      if (typeof e === 'object' && e !== null && (e as { statusCode?: string }).statusCode === 'CANCELED') {
        setState('ready')
        return
      }
      setError(labels.failed_desc)
      setState('failed')
      return
    }

    const token = paymentData.paymentMethodData.tokenizationData.token

    try {
      const res = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'google_pay',
          agreedToTerms,
          googlePayToken: token,
          blocks: blocks.map((b) => ({
            date: b.date,
            startHour: b.startHour,
            duration: b.duration,
            tableNumber: b.tableNumber,
          })),
        }),
      })

      if (!res.ok) {
        let message = labels.failed_desc
        try { const body = await res.json(); message = body.error || message } catch { /* non-JSON */ }
        setError(message)
        setState('failed')
        return
      }

      const json = await res.json()
      setState('success')
      onSuccess(json.bookingId ? String(json.bookingId) : undefined)
    } catch {
      setError(labels.failed_desc)
      setState('failed')
    }
  }

  async function fetchAmount(): Promise<string | null> {
    try {
      const res = await fetch('/api/checkout/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks }),
      })
      if (!res.ok) return null
      const { total } = await res.json()
      return typeof total === 'number' ? total.toFixed(2) : String(total)
    } catch {
      return null
    }
  }

  function baseCardPaymentMethod() {
    return {
      type: 'CARD',
      parameters: {
        allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
        allowedCardNetworks: ['MASTERCARD', 'VISA'],
      },
    }
  }

  function cardPaymentMethod() {
    return {
      ...baseCardPaymentMethod(),
      tokenizationSpecification: {
        type: 'PAYMENT_GATEWAY',
        parameters: { gateway: 'kpay', gatewayMerchantId: merchantId },
      },
    }
  }

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
        <div style={styles.iconWrap}><CircleCheck size={48} color={GREEN_BRIGHT} aria-hidden /></div>
        <p style={styles.stateTitle}>{labels.success}</p>
        <p style={styles.stateDesc}>{labels.success_desc}</p>
      </div>
    )
  }

  if (state === 'failed') {
    return (
      <div style={styles.card}>
        <div style={styles.iconWrap}><CircleX size={48} color={DANGER} aria-hidden /></div>
        <p style={styles.stateTitle}>{labels.failed}</p>
        <p style={styles.stateDesc}>{error || labels.failed_desc}</p>
        <button type="button" onClick={() => { setState('ready'); setError(null) }} style={styles.primaryButton}>
          {labels.try_again}
        </button>
        <button type="button" onClick={onBackToMethods} style={styles.secondaryButton}>
          {labels.back_to_methods}
        </button>
      </div>
    )
  }

  if (state === 'unavailable') {
    return (
      <div style={styles.card}>
        <div style={styles.iconWrap}><CircleX size={48} color={DANGER} aria-hidden /></div>
        <p style={styles.stateTitle}>Google Pay 不可用</p>
        <p style={styles.stateDesc}>你的設備或瀏覽器不支援 Google Pay，請選擇其他付款方式</p>
        <button type="button" onClick={onBackToMethods} style={styles.primaryButton}>
          {labels.back_to_methods}
        </button>
      </div>
    )
  }

  return (
    <div style={styles.card}>
      {(state === 'idle' || state === 'loading_sdk' || state === 'processing') && (
        <>
          <div style={styles.spinner} />
          <p style={styles.stateTitle}>{labels.processing}</p>
        </>
      )}
      <div
        ref={buttonContainerRef}
        style={{
          display: state === 'ready' ? 'flex' : 'none',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          width: '100%',
        }}
        aria-label={labels.title}
      />
    </div>
  )
}

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
  spinner: {
    width: 40,
    height: 40,
    border: `3px solid ${BORDER}`,
    borderTopColor: GREEN_BRIGHT,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginBottom: 8,
  },
}
