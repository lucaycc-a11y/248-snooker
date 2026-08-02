"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CalendarPlus, Share2, ChevronDown } from "lucide-react"
import { useTranslations, useLocale } from "next-intl"
import { tokens } from "@/app/styles/tokens"
import { Starfield } from "@/app/[locale]/Starfield"
import { QRCode } from "@/components/shared/QRCode"
import { getTableName } from "@/lib/booking/constants"
import {
  ApplePayLogo,
  GooglePayLogo,
  AlipayLogo,
  WeChatPayLogo,
  VisaLogo,
} from "@/components/brand"

const DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"]

function padTime(h: number): string {
  return String(((h % 24) + 24) % 24).padStart(2, "0") + ":00"
}

// Maps bookings.payment_method (set by the Stripe webhook, see
// mapPaymentMethod in app/api/webhooks/stripe/route.ts) to the matching brand
// mark. Unknown/null falls back to a generic card mark rather than a specific
// scheme, since we don't actually know which card brand was used (Task 9).
function PaymentMark({ method }: { method?: string | null }) {
  switch (method) {
    case "apple_pay":
      return <ApplePayLogo className="h-4" />
    case "google_pay":
      return <GooglePayLogo className="h-4" />
    case "alipay_hk":
      return <AlipayLogo className="h-4" />
    case "wechat_pay":
      return <WeChatPayLogo className="h-4" />
    default:
      return <VisaLogo className="h-4" />
  }
}

const QR_PX = 126

export type TicketCardProps = {
  /** 'YYYY-MM-DD' */
  date: string
  startHour: number
  duration: number
  tableNumber: number
  bookingRef: string
  /** SPACE8-XXXXX-X companion code — encoded in the QR and printed below it (see lib/qr/jwt.ts); falls back to the ref when absent. */
  humanCode?: string
  totalPrice: number
  paymentMethod?: string | null
  /** Renders fully expanded with no collapse affordance (single-ticket orders). */
  defaultExpanded?: boolean
}

// One booking's ticket — time hero, dashed perforation, DURATION/PAID/PAYMENT
// row, its own QR (door entry validates each booking's JWT independently, so
// QR codes are never shared across tickets), ref, and per-ticket
// add-to-calendar/share actions. Collapsible: a multi-booking checkout (Task 8)
// renders one of these per row instead of a single fixed screen.
export function TicketCard({
  date,
  startHour,
  duration,
  tableNumber,
  bookingRef,
  humanCode,
  totalPrice,
  paymentMethod,
  defaultExpanded = false,
}: TicketCardProps) {
  const t = useTranslations("book")
  const t_ticket = useTranslations("ticket")
  const locale = useLocale()
  const [expanded, setExpanded] = useState(defaultExpanded)

  const endHour = startHour + duration
  const crossDay = endHour >= 24
  const dateObj = new Date(`${date}T00:00:00`)
  const dateStr = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日 星期${DAY_NAMES[dateObj.getDay()]}`
  const tableName = getTableName(tableNumber, locale)

  // Single user-facing code across the whole ticket (calendar, share, filename)
  // so it always matches what's printed under the QR — never mix in bookingRef
  // (a different format) for anything the customer actually reads.
  const displayCode = humanCode ?? bookingRef

  const handleAddCalendar = () => {
    const start = new Date(dateObj)
    start.setHours(startHour, 0, 0, 0)
    const end = new Date(start)
    end.setHours(start.getHours() + duration)
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:Space8 · ${tableName}`,
      `DESCRIPTION:預訂編號 ${displayCode}`,
      "LOCATION:Space8",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n")
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `248-${displayCode}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleShare = async () => {
    const text = `我的 Space8 預訂 · ${tableName} · 編號 ${displayCode}`
    if (navigator.share) {
      try {
        await navigator.share({ title: "Space8", text })
      } catch {
        /* user cancelled */
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text)
    }
  }

  return (
    <motion.div
      layout
      style={{
        background: `${tokens.glassBg.dark}`,
        backdropFilter: tokens.glass.surface,
        WebkitBackdropFilter: tokens.glass.surface,
        borderRadius: 24,
        border: `1px solid ${tokens.glassBg.border}`,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Starfield sits behind the glass card content — same recipe used on
          the member page and 404 page, low opacity so it reads as ambient
          texture through the glass rather than a competing pattern. */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0, opacity: 0.3, pointerEvents: "none" }}>
        <Starfield />
      </div>

      {/* Collapsed summary row — tap to expand into the full ticket. */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: 20,
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: tokens.colors.text }}>
            {padTime(startHour)} – {padTime(endHour)}
            {crossDay ? " +1日" : ""}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
            {dateStr} · {tableName}
          </div>
        </div>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ flexShrink: 0, color: "rgba(255,255,255,0.5)" }}
        >
          <ChevronDown size={18} />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: "hidden", position: "relative", zIndex: 1 }}
          >
            {/* Perforation line — the card is glass/translucent now, so a
                punched hole must be genuinely transparent (not a fake solid
                circle matching an opaque background that no longer exists). */}
            <div style={{ position: "relative", height: 20, margin: "0 0 4px" }}>
              <div
                style={{
                  position: "absolute",
                  left: -10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "transparent",
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.1)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  right: -10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "transparent",
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.1)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: 20,
                  right: 20,
                  height: 0,
                  borderTop: "2px dashed rgba(255,255,255,0.15)",
                }}
              />
            </div>

            {/* Bottom stub */}
            <div style={{ padding: "0 20px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{t_ticket("duration")}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{duration}{t("hours")}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{t_ticket("paid")}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: tokens.colors.brand }}>HK${totalPrice}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>{t_ticket("payment")}</div>
                  <PaymentMark method={paymentMethod} />
                </div>
              </div>

              {/* QR Code — per-ticket, door entry validates each independently.
                  Glow lives on this container's box-shadow only, entirely
                  outside the QR's own black/white module area (16px padding
                  gap), so scan contrast is never touched. */}
              <div
                style={{
                  position: "relative",
                  background: "#0a0a0a",
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.15)",
                  boxShadow: "0 0 24px rgba(34,197,94,0.18)",
                  padding: 16,
                  display: "flex",
                  justifyContent: "center",
                  marginBottom: 10,
                }}
              >
                <QRCode
                  data={displayCode}
                  size={QR_PX}
                  enlargeLabel={t_ticket("qr_tap_enlarge")}
                  closeLabel={t_ticket("close")}
                />
              </div>

              <div
                style={{
                  fontFamily: "'SF Mono', 'Courier New', monospace",
                  fontSize: 13,
                  color: "rgba(255,255,255,0.6)",
                  letterSpacing: "0.15em",
                  textAlign: "center",
                  marginBottom: 6,
                }}
              >
                {displayCode}
              </div>

              <div
                data-cms-key="book.ticket.footer"
                style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", textAlign: "center", marginBottom: 16 }}
              >
                {t("qr_hint")}
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button
                  type="button"
                  onClick={handleAddCalendar}
                  data-cms-key="book.ticket.add-calendar"
                  style={{
                    flex: 1,
                    height: 44,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 12,
                    color: tokens.colors.text,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  <CalendarPlus size={15} />
                  {t("add_calendar")}
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  data-cms-key="book.ticket.share"
                  style={{
                    flex: 1,
                    height: 44,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 12,
                    color: tokens.colors.text,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  <Share2 size={15} />
                  {t("share")}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
