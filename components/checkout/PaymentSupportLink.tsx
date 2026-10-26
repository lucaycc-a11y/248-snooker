"use client"

import { useTranslations } from "next-intl"
import { tokens } from "@/app/styles/tokens"
import { buildSupportMessage, whatsappSupportUrl } from "@/lib/checkout/support-whatsapp"

type Props = {
  /** Booking code or id shown to support. */
  bookingRef: string
  /** KPay order number (the last 6 digits are quoted). */
  providerOrderNo?: string | null
  /** Machine state code of the page the customer is on. */
  stateCode: string
}

// WhatsApp-to-support link for payment pages that do not use PaymentRecoveryScreen.
export function PaymentSupportLink({ bookingRef, providerOrderNo, stateCode }: Props) {
  const t = useTranslations("book")
  const phone = t("support_phone")
  const message = buildSupportMessage(t("payref_whatsapp_msg"), {
    code: bookingRef,
    order: providerOrderNo ? providerOrderNo.slice(-6) : "-",
    state: stateCode,
  })
  return (
    <a
      href={whatsappSupportUrl(phone, message)}
      target="_blank"
      rel="noopener noreferrer"
      style={{ marginTop: 8, color: tokens.colors.link, fontSize: 14, textDecoration: "none", textAlign: "center" }}
    >
      {t("recovery_support_phone").replace("{phone}", phone)}
    </a>
  )
}
