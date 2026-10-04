"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CalendarPlus, Share2, Download, QrCode } from "lucide-react"
import QRCodeLib from "qrcode"
import { useTranslations } from "next-intl"
import { tokens } from "@/app/styles/tokens"
import { Starfield } from "@/app/[locale]/Starfield"
import { QRCode } from "@/components/shared/QRCode"
import { getTableName } from "@/lib/booking/constants"
import type { OrderTicket } from "@/app/[locale]/book/page"

type TicketPrinterProps = {
  orderTicket: OrderTicket | null
  locale: string
}

function padTime(h: number): string {
  return String(((h % 24) + 24) % 24).padStart(2, "0") + ":00"
}

const PAYMENT_ICON_MAP: Record<string, string> = {
  card:        '/icons/payment/cnp-visa.png',
  fps:         '/icons/payment/fps.png',
  payme:       '/icons/payment/payme.png',
  octopus:     '/icons/payment/cloud.png',
  alipay:      '/icons/payment/alipaycn.png',
  alipayhk:    '/icons/payment/alipayhk.png',
  alipay_hk:   '/icons/payment/alipayhk.png',
  wechat:      '/icons/payment/wechat.png',
  wechat_pay:  '/icons/payment/wechat.png',
  apple_pay:   '/icons/payment/apple.png',
  google_pay:  '/icons/payment/google.png',
  unionpay_qp: '/icons/payment/cloud.png',
}

function PaymentMark({ method }: { method?: string | null }) {
  const src = (method && PAYMENT_ICON_MAP[method]) ?? '/icons/payment/cnp-visa.png'
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={method ?? 'card'} style={{ height: 20, width: 'auto', display: 'block' }} />
}

const QR_PX = 126

/**
 * Renders a consolidated multi-room order ticket with merged booking lines.
 * One QR code (member code), one total price, all rooms as text lines.
 */
function OrderedTicketCard({
  orderTicket,
  locale,
}: {
  orderTicket: OrderTicket
  locale: string
}) {
  const t = useTranslations("book")
  const t_ticket = useTranslations("ticket")
  const [shareOpen, setShareOpen] = useState(false)
  const [shareBusy, setShareBusy] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)

  // Format first line's date as header
  const firstLine = orderTicket.lines[0]
  const dateObj = firstLine ? new Date(`${firstLine.date}T00:00:00`) : new Date()
  const weekdayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
  const dateStr = firstLine
    ? t("full_date_format", {
        year: dateObj.getFullYear(),
        month: dateObj.getMonth() + 1,
        day: dateObj.getDate(),
        weekday: t(`day_${weekdayNames[dateObj.getDay()]}`)
      })
    : ""

  const handleAddCalendar = () => {
    // Generate one VEVENT per merged line
    const events = orderTicket.lines.map((line) => {
      const start = new Date(`${line.date}T00:00:00`)
      start.setHours(line.startHour, 0, 0, 0)
      const end = new Date(start)
      end.setHours(start.getHours() + line.duration)
      const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
      const tableName = getTableName(line.tableNumber, locale)
      return [
        "BEGIN:VEVENT",
        `DTSTART:${fmt(start)}`,
        `DTEND:${fmt(end)}`,
        `SUMMARY:Space8 · ${tableName}`,
        "LOCATION:Space8",
        "END:VEVENT",
      ].join("\r\n")
    })
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      ...events,
      "END:VCALENDAR",
    ].join("\r\n")
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `SPACE8-${orderTicket.memberCode}-${firstLine?.date || "booking"}.ics`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleShare = async () => {
    setShareBusy(true)
    setShareError(null)
    try {
      const canvas = document.createElement("canvas")
      canvas.width = 420
      const lineHeight = 48
      canvas.height = 160 + orderTicket.lines.length * lineHeight + 140 + 20
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("canvas context")

      ctx.fillStyle = "#000"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = "#fff"
      ctx.font = "bold 16px -apple-system, sans-serif"
      ctx.textAlign = "center"
      ctx.fillText("Space8 · 預訂確認", canvas.width / 2, 30)

      let y = 70
      ctx.font = "14px -apple-system, sans-serif"
      for (const line of orderTicket.lines) {
        const tableName = getTableName(line.tableNumber, locale)
        const start = padTime(line.startHour)
        const end = padTime(line.startHour + line.duration)
        ctx.fillText(`${start} – ${end} · ${tableName}`, canvas.width / 2, y)
        y += lineHeight
      }

      y += 20
      ctx.font = "bold 18px -apple-system, sans-serif"
      ctx.fillStyle = tokens.colors.brand
      ctx.fillText(`已付: HK$${orderTicket.totalPrice}`, canvas.width / 2, y)

      y += 60
      try {
        const qrDataUrl = await QRCodeLib.toDataURL(orderTicket.memberCode, {
          width: QR_PX,
          color: { dark: "#000", light: "#fff" },
        })
        const qrImg = new Image()
        qrImg.onload = () => {
          ctx!.drawImage(qrImg, (canvas.width - QR_PX) / 2, y)
          const dataUrl = canvas.toDataURL("image/png")
          const text = `Space8 預訂確認\n\n${orderTicket.lines.map((l) => {
            const tableName = getTableName(l.tableNumber, locale)
            const start = padTime(l.startHour)
            const end = padTime(l.startHour + l.duration)
            return `${start}–${end} · ${tableName}`
          }).join("\n")}\n\n已付: HK$${orderTicket.totalPrice}\n${orderTicket.memberCode}`

          if (navigator.share) {
            navigator.share({
              title: "Space8 預訂確認",
              text,
              files: [new File([dataUrl], "booking.png", { type: "image/png" })],
            }).catch(() => {})
          } else {
            const link = document.createElement("a")
            link.href = dataUrl
            link.download = "SPACE8-booking.png"
            link.click()
          }
          setShareOpen(false)
        }
        qrImg.src = qrDataUrl
      } catch {
        setShareError("QR生成失敗")
      }
    } catch (e) {
      setShareError("分享失敗")
      console.error(e)
    } finally {
      setShareBusy(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
      style={{
        background: `linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)`,
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: tokens.radius.card,
        padding: 24,
        backdropFilter: "blur(10px)",
        marginBottom: 20,
      }}
    >
      {/* Header with date */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: tokens.colors.textMuted, marginBottom: 4 }}>
          {dateStr}
        </div>
      </div>

      {/* Room lines */}
      <div style={{ marginBottom: 20 }}>
        {orderTicket.lines.map((line, i) => {
          const tableName = getTableName(line.tableNumber, locale)
          const start = padTime(line.startHour)
          const end = padTime(line.startHour + line.duration)
          return (
            <div
              key={i}
              style={{
                fontSize: 14,
                color: tokens.colors.text,
                marginBottom: i < orderTicket.lines.length - 1 ? 16 : 0,
                lineHeight: 1.4,
              }}
            >
              {start} – {end} · {tableName}
            </div>
          )
        })}
      </div>

      {/* Dashed line */}
      <div
        style={{
          borderTop: "1px dashed rgba(255,255,255,0.2)",
          margin: "20px 0",
        }}
      />

      {/* Discounts (if any) */}
      {(orderTicket.promoDiscount || orderTicket.creditDiscount) && (
        <div style={{ marginBottom: 12 }}>
          {orderTicket.creditDiscount && orderTicket.creditDiscount > 0 && (
            <div style={{ fontSize: 12, color: tokens.colors.brand }}>
              Space Wallet 折抵 HK${orderTicket.creditDiscount}
            </div>
          )}
          {orderTicket.promoDiscount && orderTicket.promoDiscount > 0 && (
            <div style={{ fontSize: 12, color: tokens.colors.brand }}>
              優惠碼折扣 HK${orderTicket.promoDiscount}
            </div>
          )}
        </div>
      )}

      {/* Three-cell row: 時長 / 已付 / 付款 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 16,
          marginBottom: 20,
          fontSize: 13,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ color: tokens.colors.textMuted, marginBottom: 4 }}>
            {t_ticket("duration")}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {orderTicket.totalHours}
            {t_ticket("hours")}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: tokens.colors.textMuted, marginBottom: 4 }}>
            {t_ticket("paid")}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: tokens.colors.brand }}>
            HK${orderTicket.totalPrice}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: tokens.colors.textMuted, marginBottom: 4 }}>
            {t_ticket("payment_method")}
          </div>
          <PaymentMark method={orderTicket.paymentMethod} />
        </div>
      </div>

      {/* QR Code */}
      {orderTicket.memberCode ? (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.2, type: "spring", stiffness: 200, damping: 20 }}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <QRCode data={orderTicket.memberCode} size={QR_PX} />
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: tokens.colors.text,
              marginTop: 12,
              fontFamily: '"Source Code Pro", monospace',
              letterSpacing: 1,
            }}
          >
            {orderTicket.memberCode}
          </div>
        </motion.div>
      ) : (
        <div
          style={{
            background: "rgba(255,100,100,0.1)",
            border: "1px solid rgba(255,100,100,0.3)",
            borderRadius: tokens.radius.input,
            padding: 16,
            textAlign: "center",
            fontSize: 13,
            color: "#ff6464",
            marginBottom: 20,
          }}
        >
          {t_ticket("qr_unavailable")}
        </div>
      )}

      {/* Booking references */}
      <div
        style={{
          fontSize: 11,
          color: tokens.colors.textMuted,
          textAlign: "center",
          marginBottom: 20,
          fontFamily: '"Source Code Pro", monospace',
        }}
      >
        預約編號 {orderTicket.lines.map((l) => l.humanCode ?? l.bookingRef).join(" · ")}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 12 }}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleAddCalendar}
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: tokens.radius.button,
            padding: "12px 16px",
            color: tokens.colors.text,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <CalendarPlus size={16} />
          {t_ticket("add_calendar")}
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShareOpen(!shareOpen)}
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: tokens.radius.button,
            padding: "12px 16px",
            color: tokens.colors.text,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Share2 size={16} />
          {t_ticket("share")}
        </motion.button>
      </div>

      <AnimatePresence>
        {shareOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{
              marginTop: 12,
              padding: 12,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: tokens.radius.input,
              textAlign: "center",
            }}
          >
            {shareError ? (
              <div style={{ fontSize: 12, color: "#ff6464" }}>{shareError}</div>
            ) : (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleShare}
                disabled={shareBusy}
                style={{
                  width: "100%",
                  background: tokens.colors.brand,
                  color: "#000",
                  border: "none",
                  borderRadius: tokens.radius.button,
                  padding: "8px 12px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: shareBusy ? "not-allowed" : "pointer",
                  opacity: shareBusy ? 0.6 : 1,
                }}
              >
                {shareBusy ? "處理中…" : "生成並分享"}
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/**
 * A physical-feeling boarding-pass reveal for the confirmation screen. The
 * machine is CSS 3D so the ticket stays crisp on mobile without another
 * rendering dependency.
 */
export function TicketPrinter({
  orderTicket,
  locale,
}: TicketPrinterProps) {
  const t = useTranslations("ticket")

  if (!orderTicket) {
    return (
      <section
        className="ticket-printer-stage"
        aria-label={t("printer_aria")}
        aria-live="polite"
      >
        <div className="ticket-printer-scene" style={{ height: 420 }} />
      </section>
    )
  }

  return (
    <section
      className="ticket-printer-stage"
      aria-label={t("printer_aria")}
      aria-live="polite"
    >
      <div className="ticket-printer-scene">
        <div className="ticket-printer-ambient" aria-hidden="true" />
        <div className="ticket-printer-machine" aria-hidden="true">
          <div className="ticket-printer-lid">
            <div className="ticket-printer-lid-highlight" />
          </div>
          <div className="ticket-printer-slot">
            <span className="ticket-printer-status-light" />
          </div>
          <div className="ticket-printer-front" />
        </div>

        <div className="ticket-printer-paper-viewport">
          <div className="ticket-printer-paper-wrap">
            <OrderedTicketCard orderTicket={orderTicket} locale={locale} />
          </div>
        </div>
      </div>

      <style jsx>{`
        .ticket-printer-stage {
          width: 100%;
          margin: 0 auto 28px;
          color: ${tokens.colors.text};
        }

        .ticket-printer-scene {
          position: relative;
          width: min(100%, 460px);
          height: auto;
          min-height: 716px;
          margin: 0 auto -96px;
          overflow: visible;
          perspective: 1200px;
          isolation: isolate;
        }

        .ticket-printer-ambient {
          position: absolute;
          inset: 0;
          border-radius: ${tokens.radius.card};
          background: radial-gradient(circle at 50% 20%, rgba(255, 255, 255, 0.045), transparent 38%);
          pointer-events: none;
          z-index: -1;
        }

        .ticket-printer-machine {
          position: absolute;
          top: 24px;
          left: 50%;
          width: min(420px, calc(100% - 18px));
          height: 76px;
          transform: translateX(-50%) rotateX(7deg) rotateY(-2deg);
          transform-style: preserve-3d;
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 22px 22px 12px 12px;
          background: linear-gradient(165deg, #5b6571 0%, #2c3541 25%, #111820 78%);
          box-shadow: inset 0 9px 15px rgba(255, 255, 255, 0.14), 0 14px 18px rgba(0, 0, 0, 0.48);
          z-index: 7;
        }

        .ticket-printer-machine::after {
          content: "";
          position: absolute;
          right: -1px;
          bottom: -15px;
          left: -1px;
          height: 17px;
          border-radius: 0 0 18px 18px;
          background: linear-gradient(180deg, #3b4653, #18212d);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-top: 0;
        }

        .ticket-printer-lid {
          position: absolute;
          inset: 7px 9px auto;
          height: 34px;
          border-radius: 16px 16px 7px 7px;
          background: linear-gradient(180deg, rgba(142, 154, 165, 0.35), rgba(16, 24, 34, 0.14));
          transform: translateZ(8px) rotateX(13deg);
          transform-origin: bottom;
        }

        .ticket-printer-lid-highlight {
          position: absolute;
          top: 4px;
          right: 16px;
          left: 16px;
          height: 2px;
          border-radius: 99px;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.55), transparent);
        }

        .ticket-printer-slot {
          position: absolute;
          right: 44px;
          bottom: 9px;
          left: 44px;
          height: 7px;
          border-radius: 2px;
          background: #02040a;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.9), 0 1px rgba(255, 255, 255, 0.65);
          z-index: 5;
        }

        .ticket-printer-status-light {
          position: absolute;
          top: 50%;
          right: -21px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${tokens.colors.brand};
          box-shadow: 0 0 10px ${tokens.colors.brand}, 0 0 20px rgba(37, 211, 102, 0.72);
          transform: translateY(-50%);
          animation: ticket-printer-pulse 1.7s ease-in-out infinite;
        }

        .ticket-printer-front {
          position: absolute;
          right: 14px;
          bottom: -4px;
          left: 14px;
          height: 4px;
          border-radius: 0 0 4px 4px;
          background: rgba(0, 0, 0, 0.55);
        }

        .ticket-printer-paper-viewport {
          position: absolute;
          top: 91px;
          left: 50%;
          width: min(352px, calc(100% - 42px));
          max-height: none;
          padding-bottom: 20px;
          overflow: visible;
          clip-path: inset(0 -60px -2000px -60px);
          transform: translateX(-50%);
          perspective: 1200px;
          perspective-origin: 50% 0%;
          pointer-events: none;
          z-index: 6;
        }

        .ticket-printer-paper-wrap {
          position: relative;
          width: 100%;
          transform: translateY(-600px) rotateX(-5deg) scaleY(0.72);
          transform-origin: top center;
          animation: ticket-paper-eject 2.5s steps(24, end) forwards;
          pointer-events: auto;
        }

        .ticket-printer-paper-wrap :global(button) {
          pointer-events: auto;
        }

        @keyframes ticket-paper-eject {
          0% { opacity: 0.6; transform: translateY(-96%) rotateX(-16deg) translateZ(-22px); }
          15% { opacity: 0.85; transform: translateY(-76%) rotateX(-12deg) translateZ(14px); }
          35% { opacity: 0.95; transform: translateY(-54%) rotateX(-8deg) translateZ(22px); }
          60% { opacity: 1; transform: translateY(-28%) rotateX(-5deg) translateZ(16px); }
          82% { transform: translateY(-6%) rotateX(-2deg) translateZ(8px); }
          95% { transform: translateY(1.5%) rotateX(1deg) translateZ(2px); }
          100% { opacity: 1; transform: translateY(0%) rotateX(0deg) translateZ(0); }
        }

        @keyframes ticket-printer-pulse {
          0%, 100% { opacity: 0.55; transform: translateY(-50%) scale(0.86); }
          50% { opacity: 1; transform: translateY(-50%) scale(1.15); }
        }

        @media (max-width: 380px) {
          .ticket-printer-scene {
            min-height: 640px;
            transform: scale(0.91);
            transform-origin: top center;
            margin-bottom: -38px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .ticket-printer-paper-wrap {
            animation: none;
            transform: translateY(0%) rotateX(0deg) translateZ(0);
          }

          .ticket-printer-status-light { animation: none; }
        }

        @media (prefers-reduced-motion: no-preference) {
          .ticket-printer-paper-wrap {
            animation-timing-function: ${tokens.easing.spring};
          }
        }
      `}</style>
    </section>
  )
}
