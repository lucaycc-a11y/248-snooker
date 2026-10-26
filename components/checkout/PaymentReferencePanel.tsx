"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { tokens } from "@/app/styles/tokens"
import type { PaymentReference } from "@/lib/booking/useOrderConfirmationPolling"

type Props = {
  reference: PaymentReference | null
  stateCode: string | null
  /** Fallback when the status API has not answered yet. */
  bookingId: string
}

function whatsappDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  return digits.length === 8 ? `852${digits}` : digits
}

// Reference block for payment / confirm pages: booking code, KPay order tail, the
// machine state code and the check time, with copy and a prefilled WhatsApp message.
// Every value is non-secret and is exactly what support needs to find the payment_events
// timeline of this booking.
export function PaymentReferencePanel({ reference, stateCode, bookingId }: Props) {
  const t = useTranslations("book")
  const [copied, setCopied] = useState(false)
  const code = reference?.code ?? bookingId.slice(0, 8)
  const order = reference?.orderTail ?? "-"
  const state = stateCode ?? "-"
  const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  const text = `${code} · ${order} · ${state} · ${time}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable: the value is still on screen to read out
    }
  }

  const message = t("payref_whatsapp_msg", { code, order, state, time })
  const href = `https://wa.me/${whatsappDigits(t("support_phone"))}?text=${encodeURIComponent(message)}`

  return (
    <div style={{ width: "100%", marginTop: 8, padding: 12, borderRadius: 12, border: `1px solid ${tokens.colors.border}`, textAlign: "left" }}>
      <div style={{ color: tokens.colors.textMuted, fontSize: 12, marginBottom: 6 }}>{t("payref_title")}</div>
      <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 12px", fontSize: 12, color: tokens.colors.text }}>
        <dt style={{ color: tokens.colors.textFaint }}>{t("payref_booking")}</dt><dd style={{ margin: 0, wordBreak: "break-all" }}>{code}</dd>
        <dt style={{ color: tokens.colors.textFaint }}>{t("payref_order")}</dt><dd style={{ margin: 0 }}>{order}</dd>
        <dt style={{ color: tokens.colors.textFaint }}>{t("payref_state")}</dt><dd style={{ margin: 0 }}>{state}</dd>
        <dt style={{ color: tokens.colors.textFaint }}>{t("payref_time")}</dt><dd style={{ margin: 0 }}>{time}</dd>
      </dl>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button type="button" onClick={copy} style={{ minHeight: 40, padding: "0 14px", borderRadius: 10, border: `1px solid ${tokens.colors.border}`, background: "transparent", color: tokens.colors.text, fontSize: 13, cursor: "pointer" }}>
          {copied ? t("payref_copied") : t("payref_copy")}
        </button>
        <a href={href} target="_blank" rel="noopener noreferrer" style={{ minHeight: 40, display: "inline-flex", alignItems: "center", padding: "0 14px", borderRadius: 10, border: `1px solid ${tokens.colors.border}`, color: tokens.colors.text, fontSize: 13, textDecoration: "none" }}>
          {t("payref_whatsapp")}
        </a>
      </div>
    </div>
  )
}
