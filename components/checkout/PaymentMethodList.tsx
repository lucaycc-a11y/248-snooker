"use client"

// ────────────────────────────────────────────────────────────────
// PaymentMethodList — full payment method selector for the Space8
// checkout flow. Nine methods, each with a label, sublabel, and
// branded badge icons. Two layers of gating:
//
//   1. UI disabled (this file) — Google Pay / Apple Pay are always
//      disabled ("即將推出"). They stay visible but are inert.
//
//   2. Backend gate — POST /api/checkout/create rejects apple_pay
//      and google_pay with 400. The three KPay methods (fps, payme,
//      octopus) additionally check payment_settings.enabled.
//
// alipay / alipayhk / wechat / unionpay_qp are marked disabled:false
// (clickable) but the backend has no implementation for them — they
// will return a 400 error. This is intentional per the spec.
// ────────────────────────────────────────────────────────────────

import { tokens } from "@/app/styles/tokens"
import PaymentMethodCard from "./PaymentMethodCard"
import {
  VisaBadgeIcon,
  MastercardBadgeIcon,
  GooglePayBadgeIcon,
  ApplePayBadgeIcon,
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
  | "google_pay"
  | "apple_pay"
  | "alipay"
  | "alipayhk"
  | "wechat"
  | "unionpay_qp"
  | "octopus"
  | "payme"
  | "fps"

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
    id: "google_pay",
    label: "Google Pay",
    sublabel: "用手機一鍵付款",
    disabled: true,
    disabledReason: "即將推出",
    icons: <GooglePayBadgeIcon />,
  },
  {
    id: "apple_pay",
    label: "Apple Pay",
    sublabel: "用 Apple Pay 快速付款",
    disabled: true,
    disabledReason: "即將推出",
    icons: <ApplePayBadgeIcon />,
  },
  {
    id: "alipay",
    label: "支付寶",
    sublabel: "Alipay 中國內地帳戶",
    disabled: false,
    icons: <AlipayBadgeIcon />,
  },
  {
    id: "alipayhk",
    label: "AlipayHK",
    sublabel: "香港支付寶錢包",
    disabled: false,
    icons: <AlipayHKBadgeIcon />,
  },
  {
    id: "wechat",
    label: "微信支付",
    sublabel: "WeChat Pay",
    disabled: false,
    icons: <WeChatPayBadgeIcon />,
  },
  {
    id: "unionpay_qp",
    label: "雲閃付",
    sublabel: "UnionPay QuickPass",
    disabled: false,
    icons: <UnionPayQuickPassBadgeIcon />,
  },
  {
    id: "octopus",
    label: "八達通",
    sublabel: "Octopus",
    disabled: false,
    icons: <OctopusBadgeIcon />,
  },
  {
    id: "payme",
    label: "PayMe",
    sublabel: "HSBC PayMe",
    disabled: false,
    icons: <PayMeBadgeIcon />,
  },
  {
    id: "fps",
    label: "轉數快",
    sublabel: "FPS · 60 秒內完成過數",
    disabled: false,
    icons: <FpsBadgeIcon />,
  },
]

// ── Props ──────────────────────────────────────────────────────

type Props = {
  selected: PaymentMethodId | null
  onSelect: (method: PaymentMethodId) => void
}

// ── Component ──────────────────────────────────────────────────

export default function PaymentMethodList({ selected, onSelect }: Props) {
  return (
    <div
      style={{
        background: tokens.colors.surface,
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: tokens.radius.card,
        padding: 24,
        marginBottom: 20,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {PAYMENT_METHODS.map((method) => (
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