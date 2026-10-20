"use client"

// ────────────────────────────────────────────────────────────────
// PaymentMethodList — payment method selector for the Space8 checkout
// flow. PAYMENT_METHODS is the catalog; KPAY_METHODS is the ordered
// KPay rail set. The live list is that set minus anything turned off
// in admin payment_settings (fetched from /api/payment/available-methods).
// ────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react"
import { tokens } from "@/app/styles/tokens"
import { PAYMENT_METHODS as KPAY_RAIL_ORDER } from "@/lib/payments/methods"
import PaymentMethodCard from "./PaymentMethodCard"
import {
  VisaBadgeIcon,
  MastercardBadgeIcon,
  AlipayBadgeIcon,
  AlipayHKBadgeIcon,
  WeChatPayBadgeIcon,
  UnionPayQuickPassBadgeIcon,
  PayMeBadgeIcon,
  OctopusBadgeIcon,
  FpsBadgeIcon,
  UnionPayCNPBadgeIcon,
  JcbBadgeIcon,
  DinersBadgeIcon,
  AmexBadgeIcon,
} from "./icons/PaymentIcons"

// ── Method definition ──────────────────────────────────────────

export type PaymentMethodId =
  | "card"
  | "alipay"
  | "alipayhk"
  | "wechat"
  | "wechat_pay"
  | "unionpay_qp"
  | "octopus"
  | "payme"
  | "fps"
  | "google_pay"
  | "apple_pay"

type PaymentMethodConfig = {
  id: PaymentMethodId
  label: string
  sublabel: string
  /** UI-only disabled — the card stays visible but is inert. */
  disabled: boolean
  /** Overrides sublabel when disabled (defaults to "即將推出"). */
  disabledReason?: string
  /** Right-hand badge icons, one or more. */
  icons: React.ReactNode
}

const PAYMENT_METHODS: PaymentMethodConfig[] = [
  {
    id: "card",
    label: "信用卡",
    sublabel: "",
    disabled: false,
    icons: (
      <>
        <VisaBadgeIcon />
        <MastercardBadgeIcon />
        <UnionPayCNPBadgeIcon />
        <JcbBadgeIcon />
        <DinersBadgeIcon />
        <AmexBadgeIcon />
      </>
    ),
  },
  {
    id: "alipayhk",
    label: "AlipayHK",
    sublabel: "香港支付寶錢包",
    disabled: false,
    icons: <AlipayHKBadgeIcon />,
  },
  {
    id: "google_pay",
    label: "Google Pay",
    sublabel: "",
    disabled: false,
    icons: (
      <img
        src="/logos/payment/google.png"
        alt="Google Pay"
        style={{ height: 20, width: 'auto' }}
      />
    ),
  },
  {
    id: "apple_pay",
    label: "Apple Pay",
    sublabel: "",
    disabled: false,
    icons: (
      <img
        src="/logos/payment/apple.png"
        alt="Apple Pay"
        style={{ height: 20, width: 'auto' }}
      />
    ),
  },
  {
    id: "wechat_pay",
    label: "微信支付",
    sublabel: "WeChat Pay",
    disabled: false,
    icons: <WeChatPayBadgeIcon />,
  },
  {
    id: "payme",
    label: "PayMe",
    sublabel: "HSBC PayMe",
    disabled: false,
    icons: <PayMeBadgeIcon />,
  },
  {
    id: "wechat",
    label: "微信支付",
    sublabel: "WeChat Pay",
    disabled: false,
    icons: <WeChatPayBadgeIcon />,
  },
  {
    id: "octopus",
    label: "八達通",
    sublabel: "Octopus",
    disabled: false,
    icons: <OctopusBadgeIcon />,
  },
  {
    id: "fps",
    label: "轉數快",
    sublabel: "FPS · 60 秒內完成過數",
    disabled: false,
    icons: <FpsBadgeIcon />,
  },
  {
    id: "alipay",
    label: "支付寶",
    sublabel: "Alipay 中國內地帳戶",
    disabled: false,
    icons: <AlipayBadgeIcon />,
  },
  {
    id: "unionpay_qp",
    label: "雲閃付",
    sublabel: "UnionPay QuickPass",
    disabled: false,
    icons: <UnionPayQuickPassBadgeIcon />,
  },
]

// Controls both visibility and display order. Add a method here when it launches.
// Provider-aware: the live list is queried from /api/payment/available-methods.
// KPay offers every rail /api/checkout/create accepts; anything an operator
// turns off in admin payment_settings is filtered out at fetch time.

/** Full KPay rail set, in customer-facing order. Derived from the canonical
 *  list in lib/payments/methods.ts so the checkout, the admin toggles and
 *  /api/payment/available-methods can never drift apart. Order there is
 *  cards → HK instant/wallets → mainland wallets → UnionPay QuickPass. */
const KPAY_METHODS: readonly PaymentMethodId[] = KPAY_RAIL_ORDER.map((m) => m.method)

// Stripe methods are now loaded dynamically — this is just a fallback
const STRIPE_FALLBACK_METHODS: readonly PaymentMethodId[] = ['card']

/** Display name for a rail, for the "pay with …" confirm button. Single source
 * of truth — the CTA must never drift from the card the customer tapped. */
export function paymentMethodLabel(id: PaymentMethodId): string {
  return PAYMENT_METHODS.find((m) => m.id === id)?.label ?? id
}

// ── Props ──────────────────────────────────────────────────────

type Props = {
  selected: PaymentMethodId | null
  onSelect: (method: PaymentMethodId) => void
  /**
   * Render the KPay catalogue regardless of NEXT_PUBLIC_PAYMENT_PROVIDER.
   * Omit for the exact previous behaviour (env-derived). Admin KPay mode
   * passes this so the admin sees the real KPay rails — the build-time
   * provider is 'stripe', which would otherwise load Stripe's method list.
   */
  forceKpay?: boolean
}

// ── Component ──────────────────────────────────────────────────

export default function PaymentMethodList({ selected, onSelect, forceKpay }: Props) {
  // forceKpay pins the catalogue to KPay; otherwise follow the build-time
  // provider exactly as before.
  const provider = forceKpay ? 'kpay' : process.env.NEXT_PUBLIC_PAYMENT_PROVIDER || 'kpay'

  // State: method ids the server says are actually offered right now.
  // For KPay that is KPAY_METHODS minus admin-disabled rails; for Stripe it is
  // whatever the account has configured. Null = still loading / not fetched.
  const [enabledMethods, setEnabledMethods] = useState<PaymentMethodId[] | null>(null)
  const [isLoadingMethods, setIsLoadingMethods] = useState(true)

  // Fallback if the lookup fails: never leave the checkout with nothing to tap.
  // KPay falls back to the full rail set (create still rejects anything an
  // operator turned off); Stripe stays conservative with card only.
  const fallbackMethods: readonly PaymentMethodId[] =
    provider === 'stripe' ? STRIPE_FALLBACK_METHODS : KPAY_METHODS

  // Effect: ask the server which methods are offered (admin payment_settings
  // for KPay, live Stripe account config for Stripe).
  useEffect(() => {
    let cancelled = false

    const fetchMethods = async () => {
      try {
        const res = await fetch(`/api/payment/available-methods?provider=${provider}`)
        if (!res.ok) {
          console.warn('[PaymentMethodList] methods query failed, using fallback')
          if (!cancelled) setEnabledMethods([...fallbackMethods])
          return
        }

        const data: unknown = await res.json()
        const available =
          typeof data === 'object' && data !== null && Array.isArray((data as { available?: unknown }).available)
            ? ((data as { available: unknown[] }).available.filter(
                (id): id is PaymentMethodId => typeof id === 'string',
              ) as PaymentMethodId[])
            : []

        console.log('[PaymentMethodList] Loaded methods:', available)
        if (!cancelled) setEnabledMethods(available.length > 0 ? available : [...fallbackMethods])
      } catch (err) {
        console.error('[PaymentMethodList] Failed to fetch methods', err)
        if (!cancelled) setEnabledMethods([...fallbackMethods])
      } finally {
        if (!cancelled) setIsLoadingMethods(false)
      }
    }

    fetchMethods()
    return () => {
      cancelled = true
    }
    // fallbackMethods is derived from provider alone; listing it would re-run
    // the fetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider])

  // Compute visible methods based on provider. Preserve the provider's display
  // order (KPAY_METHODS) rather than whatever order the server returned.
  const catalog = provider === 'stripe' ? null : KPAY_METHODS
  const visibleMethods = (catalog ?? (enabledMethods ?? []))
    .flatMap((id) => PAYMENT_METHODS.filter((method) => method.id === id))
    .filter((method) => (enabledMethods ? enabledMethods.includes(method.id) : true))

  // Skeleton placeholder — shown while the available-methods lookup is in
  // flight. Matches PaymentMethodCard geometry exactly so no layout shift.
  if (isLoadingMethods) {
    return (
      <>
        <style>{`
          @keyframes payment-skeleton-pulse {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 1; }
          }
          .payment-skeleton-pulse {
            animation: payment-skeleton-pulse 1.6s ease-in-out infinite;
          }
        `}</style>
        <div
          className="payment-skeleton-pulse"
          style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}
          aria-busy="true"
          aria-label="載入付款方式"
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                minHeight: 56,
                padding: "12px 16px",
                border: `1.5px solid ${tokens.colors.border}`,
                borderRadius: 16,
                background: tokens.colors.surface,
                display: "flex",
                alignItems: "center",
                gap: 14,
                animationDelay: `${i * 0.12}s`,
              }}
            >
              {/* Radio circle */}
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  border: `2px solid ${tokens.colors.border}`,
                  flexShrink: 0,
                }}
              />
              {/* Label + sublabel bars */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <div
                  style={{
                    height: 13,
                    width: "42%",
                    borderRadius: 6,
                    background: tokens.colors.border,
                  }}
                />
                <div
                  style={{
                    height: 10,
                    width: "62%",
                    borderRadius: 6,
                    background: tokens.colors.border,
                    opacity: 0.6,
                  }}
                />
              </div>
              {/* Icon badge placeholder */}
              <div
                style={{
                  width: 36,
                  height: 22,
                  borderRadius: 6,
                  background: tokens.colors.border,
                  flexShrink: 0,
                  opacity: 0.5,
                }}
              />
            </div>
          ))}
        </div>
      </>
    )
  }

  return (
    // Container is a quiet grouping wrapper — no own fill/border — so the
    // interactive PaymentMethodCards are the only elevated surfaces here.
    <div
      style={{
        padding: 0,
        marginBottom: 20,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {visibleMethods.map((method) => (
        <PaymentMethodCard
          key={method.id}
          method={method.id}
          label={method.label}
          sublabel={method.sublabel}
          icons={method.icons}
          selected={selected === method.id}
          disabled={method.disabled}
          disabledReason={method.disabledReason}
          onSelect={(method) => onSelect(method as PaymentMethodId)}
        />
      ))}
    </div>
  )
}