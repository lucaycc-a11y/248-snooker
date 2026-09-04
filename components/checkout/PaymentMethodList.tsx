"use client"

import { useState } from "react"

// ────────────────────────────────────────────────────────────────
// PaymentMethodList — full payment method selector for the Space8
// checkout flow. Eight methods, each with a label, sublabel, and
// branded badge icons. The backend still rejects any direct API request
// using the permanently unsupported Apple Pay / Google Pay method IDs.
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

/** Display name for a rail, for the "pay with …" confirm button. Single source
 * of truth — the CTA must never drift from the card the customer tapped. */
export function paymentMethodLabel(id: PaymentMethodId): string {
  return PAYMENT_METHODS.find((m) => m.id === id)?.label ?? id
}

// ── Props ──────────────────────────────────────────────────────

type Props = {
  selected: PaymentMethodId | null
  onSelect: (method: PaymentMethodId) => void
  /** When true, collapse non-essential methods behind a "more" toggle. */
  collapsed?: boolean
}

// ── Component ──────────────────────────────────────────────────

const FEATURED_METHODS: PaymentMethodId[] = ['card', 'alipay', 'fps']

export default function PaymentMethodList({ selected, onSelect, collapsed }: Props) {
  const [expanded, setExpanded] = useState(false)

  // Nothing selected or expanded — show all; collapsed mode shows only featured
  const visibleMethods =
    collapsed && !expanded
      ? PAYMENT_METHODS.filter((m) => FEATURED_METHODS.includes(m.id))
      : PAYMENT_METHODS

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
      {collapsed && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          style={{
            background: "transparent",
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: tokens.radius.button,
            padding: "12px 16px",
            color: tokens.colors.textMuted,
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            marginTop: 4,
            transition: "border-color 0.2s",
          }}
        >
          更多付款方式
        </button>
      )}
    </div>
  )
}