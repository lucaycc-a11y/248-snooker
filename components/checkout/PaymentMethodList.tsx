"use client"

// ────────────────────────────────────────────────────────────────
// PaymentMethodList — payment method selector for the Space8 checkout
// flow. PAYMENT_METHODS is the catalog; AVAILABLE_PAYMENT_METHODS is
// the ordered allowlist for methods currently shown in the UI.
// ────────────────────────────────────────────────────────────────

import { tokens } from "@/app/styles/tokens"
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
  | "unionpay_qp"
  | "octopus"
  | "payme"
  | "fps"
  | "apple_pay"
  | "google_pay"

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
    id: "alipay",
    label: "支付寶",
    sublabel: "Alipay 中國內地帳戶",
    disabled: false,
    icons: <AlipayBadgeIcon />,
  },
  {
    id: "apple_pay",
    label: "Apple Pay",
    sublabel: "Apple 裝置專用",
    disabled: false,
    icons: <span style={{ fontSize: 18 }}>🍎</span>,
  },
  {
    id: "google_pay",
    label: "Google Pay",
    sublabel: "Google 帳戶支付",
    disabled: false,
    icons: <span style={{ fontSize: 18 }}>🅖</span>,
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
    id: "unionpay_qp",
    label: "雲閃付",
    sublabel: "UnionPay QuickPass",
    disabled: false,
    icons: <UnionPayQuickPassBadgeIcon />,
  },
]

// Payment provider-specific method lists
// KPay: card (CNP Hosted), alipayhk, payme
// Stripe: card, alipay, apple_pay, google_pay
const KPAY_METHODS: readonly PaymentMethodId[] = ["card", "alipayhk", "payme"]
const STRIPE_METHODS: readonly PaymentMethodId[] = ["card", "alipay", "google_pay", "apple_pay"]

// Read PAYMENT_PROVIDER from environment (client-side via NEXT_PUBLIC_ prefix)
// Defaults to 'kpay' if not set
const PAYMENT_PROVIDER = typeof window !== 'undefined'
  ? (window as { NEXT_PUBLIC_PAYMENT_PROVIDER?: string }).NEXT_PUBLIC_PAYMENT_PROVIDER || 'kpay'
  : 'kpay'

const AVAILABLE_PAYMENT_METHODS: readonly PaymentMethodId[] =
  PAYMENT_PROVIDER === 'stripe' ? STRIPE_METHODS : KPAY_METHODS

const visibleMethods = AVAILABLE_PAYMENT_METHODS.flatMap((id) =>
  PAYMENT_METHODS.filter((method) => method.id === id)
)

/** Display name for a rail, for the "pay with …" confirm button. Single source
 * of truth — the CTA must never drift from the card the customer tapped. */
export function paymentMethodLabel(id: PaymentMethodId): string {
  return PAYMENT_METHODS.find((m) => m.id === id)?.label ?? id
}

// ── Props ──────────────────────────────────────────────────────

type Props = {
  selected: PaymentMethodId | null
  onSelect: (method: PaymentMethodId) => void
}

// ── Component ──────────────────────────────────────────────────

export default function PaymentMethodList({ selected, onSelect }: Props) {
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