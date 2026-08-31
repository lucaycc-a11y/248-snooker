"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CalendarPlus, Share2, ChevronDown, Download, QrCode, FileText } from "lucide-react"
import QRCodeLib from "qrcode"
import { useTranslations, useLocale } from "next-intl"
import { tokens } from "@/app/styles/tokens"
import { Starfield } from "@/app/[locale]/Starfield"
import { QRCode } from "@/components/shared/QRCode"
import { getTableName } from "@/lib/booking/constants"

const DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"]

function padTime(h: number): string {
  return String(((h % 24) + 24) % 24).padStart(2, "0") + ":00"
}

// Maps bookings.payment_method to a small payment brand image.
// KPay card bookings store method='card'; legacy Stripe methods stored
// 'apple_pay', 'google_pay', 'alipay_hk', 'wechat_pay'.
// Unknown/null falls back to the generic card mark.
const PAYMENT_ICON_MAP: Record<string, string> = {
  card:        '/icons/payment/cnp-visa.png',      // generic card — no specific scheme known
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

export type TicketCardProps = {
  /** 'YYYY-MM-DD' */
  date: string
  startHour: number
  duration: number
  tableNumber: number
  bookingRef: string
  /** SPACE8-XXXXX-X companion code — shown as plain text below the QR for customer-service lookup only; never encoded in the QR. */
  humanCode?: string
  /** Universal member identifier — the value encoded in every QR code. Always use this for QR; never use humanCode for QR. */
  memberCode: string
  totalPrice: number
  paymentMethod?: string | null
  /** Renders fully expanded with no collapse affordance (single-ticket orders). */
  defaultExpanded?: boolean
}

// One booking's ticket — time hero, dashed perforation, DURATION/PAID/PAYMENT
// row, its own QR (door entry validates each booking independently via member_code),
// ref, and per-ticket add-to-calendar/share actions. Collapsible: a multi-booking
// checkout renders one of these per row instead of a single fixed screen.
export function TicketCard({
  date,
  startHour,
  duration,
  tableNumber,
  bookingRef,
  humanCode,
  memberCode,
  totalPrice,
  paymentMethod,
  defaultExpanded = false,
}: TicketCardProps) {
  const t = useTranslations("book")
  const t_ticket = useTranslations("ticket")
  const locale = useLocale()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareBusy, setShareBusy] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)

  const endHour = startHour + duration
  const crossDay = endHour >= 24
  const dateObj = new Date(`${date}T00:00:00`)
  const dateStr = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日 星期${DAY_NAMES[dateObj.getDay()]}`
  const tableName = getTableName(tableNumber, locale)

  // displayCode is what appears as human-readable text below the QR — customer-service reference only.
  // memberCode is what gets encoded in the QR — never use humanCode/bookingRef for QR data.
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
    a.download = `SPACE8-${displayCode}.ics`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filePrefix = `SPACE8-${displayCode}`
  // Short, human-readable label for the payment method used — the same brand
  // shown via PaymentMark, falling back to the generic card label.
  const paymentLabel = (() => {
    switch (paymentMethod) {
      case "fps": return t_ticket("payment_fps")
      case "payme": return t_ticket("payment_payme")
      case "octopus": return t_ticket("payment_octopus")
      case "alipay": return t_ticket("payment_alipay")
      case "alipayhk": case "alipay_hk": return t_ticket("payment_alipayhk")
      case "wechat": case "wechat_pay": return t_ticket("payment_wechat")
      case "unionpay_qp": return t_ticket("payment_unionpay_qp")
      case "apple_pay": return t_ticket("payment_apple_pay")
      case "google_pay": return t_ticket("payment_google_pay")
      default: return t_ticket("payment_card")
    }
  })()

  const shareText = () =>
    `${t("share_caption")}\n${tableName}\n${dateStr} · ${padTime(startHour)} – ${padTime(endHour)}\n${t_ticket("paid")}: HK$${totalPrice}\n${t_ticket("payment")}: ${paymentLabel}\n${t("share_ref_label")}: ${displayCode}`

  // A single source of truth for the "ticket share" blobs — the QR here is
  // always the memberCode (the actual door-scan credential), never humanCode.
  const buildShareBlob = async (): Promise<Blob> => {
    const qrUrl = await QRCodeLib.toDataURL(memberCode, {
      margin: 2,
      width: 256,
      errorCorrectionLevel: "M",
      color: { dark: "#0a0a0a", light: "#ffffff" },
    })
    const canvas = document.createElement("canvas")
    canvas.width = 560
    canvas.height = 720
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("canvas 2d unavailable")
    // Background is intentionally opaque — shared images land on white chat
    // backgrounds and light-mode apps, where the site's pure-black glass card
    // would otherwise look like a broken/invisible block.
    ctx.fillStyle = "#0a0a0a"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Ambient dot texture to echo the on-screen starfield, so the share image
    // reads as "Space8" rather than a flat black slab.
    const star = (x: number, y: number, r: number, a: number) => {
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,${a})`
      ctx.fill()
    }
    for (let i = 0; i < 28; i++) {
      star(Math.random() * 560, Math.random() * 720, Math.random() * 1.1 + 0.3, Math.random() * 0.35 + 0.15)
    }

    const drawImage = (src: string, x: number, y: number, w: number, h: number) => {
      const img = new Image()
      img.src = src
      return new Promise<void>((resolve) => {
        img.onload = () => {
          ctx.drawImage(img, x, y, w, h)
          resolve()
        }
        img.onerror = () => resolve()
      })
    }
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"

    ctx.font = "700 26px system-ui, -apple-system, sans-serif"
    ctx.fillStyle = "#ffffff"
    ctx.fillText("Space8", 280, 46)

    ctx.font = "600 18px system-ui, -apple-system, sans-serif"
    ctx.fillStyle = "#25D366"
    ctx.fillText(`${tableName}`, 280, 78)

    ctx.font = "500 15px system-ui, -apple-system, sans-serif"
    ctx.fillStyle = "rgba(255,255,255,0.85)"
    ctx.fillText(`${dateStr} · ${padTime(startHour)} – ${padTime(endHour)}`, 280, 108)

    ctx.fillStyle = "rgba(255,255,255,0.55)"
    ctx.font = "500 14px system-ui, -apple-system, sans-serif"
    ctx.fillText(`${t_ticket("paid")}: HK$${totalPrice}`, 280, 140)
    ctx.fillText(`${t_ticket("payment")}: ${paymentLabel}`, 280, 164)

    // Separator — single thin line, above the QR.
    ctx.strokeStyle = "rgba(255,255,255,0.15)"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(40, 194)
    ctx.lineTo(520, 194)
    ctx.stroke()

    const qrImg = new Image()
    qrImg.src = qrUrl
    await new Promise<void>((resolve) => {
      qrImg.onload = () => {
        const qrW = 180
        const qrH = 180
        ctx.drawImage(qrImg, 190, 250, qrW, qrH)
        resolve()
      }
      qrImg.onerror = () => resolve()
    })

    // Payment brand icon above the ref code, small — reinforces the method
    // without letting the image become a wall of text.
    const brandSrc = (paymentMethod && PAYMENT_ICON_MAP[paymentMethod]) ?? '/icons/payment/cnp-visa.png'
    await drawImage(brandSrc, 250, 474, 60, 20)

    ctx.fillStyle = "rgba(255,255,255,0.85)"
    ctx.font = "600 15px 'SF Mono', Menlo, monospace"
    ctx.fillText(`${displayCode}`, 280, 518)

    ctx.fillStyle = "rgba(255,255,255,0.45)"
    ctx.font = "500 12px system-ui, -apple-system, sans-serif"
    ctx.fillText(`${t("share_caption")}`, 280, 546)

    ctx.fillStyle = "rgba(255,255,255,0.3)"
    ctx.font = "400 11px system-ui, -apple-system, sans-serif"
    ctx.fillText(`${t("qr_hint")}`, 280, 584)

    return await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!), "image/png"))
  }

  // Image share path — Web Share API with an attached PNG, falling back to a
  // PNG download. This is the "share the ticket as a picture" action.
  const shareCardImage = async () => {
    setShareError(null)
    setShareBusy(true)
    try {
      const blob = await buildShareBlob()
      const file = new File([blob], `${filePrefix}.png`, { type: "image/png" })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: `Space8 · ${tableName}`, text: shareText(), files: [file] })
      } else {
        downloadBlob(blob, `${filePrefix}.png`)
      }
    } catch (e) {
      if (e instanceof DOMException && (e.name === "AbortError" || e.name === "NotAllowedError")) {
        /* user cancelled the native share sheet — not an error */
      } else {
        setShareError(t("share_error"))
        console.error("[TicketCard] image share failed", e)
      }
    } finally {
      setShareBusy(false)
    }
  }

  // QR-only share — a small PNG of just the door-scan QR code, same credential
  // semantics as the full ticket image but with no booking details on it.
  const shareQrOnly = async () => {
    setShareError(null)
    setShareBusy(true)
    try {
      const qrUrl = await QRCodeLib.toDataURL(memberCode, {
        margin: 2,
        width: 512,
        errorCorrectionLevel: "M",
        color: { dark: "#0a0a0a", light: "#ffffff" },
      })
      const blob = await (await fetch(qrUrl)).blob()
      const file = new File([blob], `${filePrefix}-qr.png`, { type: "image/png" })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: `Space8 · ${tableName}`, text: shareText(), files: [file] })
      } else {
        downloadBlob(blob, `${filePrefix}-qr.png`)
      }
    } catch (e) {
      if (e instanceof DOMException && (e.name === "AbortError" || e.name === "NotAllowedError")) {
        /* user cancelled the native share sheet — not an error */
      } else {
        setShareError(t("share_error"))
        console.error("[TicketCard] QR share failed", e)
      }
    } finally {
      setShareBusy(false)
    }
  }

  // Text fallback — for browsers that support neither native share nor file
  // download of generated images. Last resort only.
  const shareTextFallback = async () => {
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareText())
      } catch {
        /* clipboard unavailable */
      }
    }
  }

  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <motion.div
      data-ticket-card
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
                  <div className="font-label" style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>{t_ticket("duration")}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{duration}{t("hours")}</div>
                </div>
                <div>
                  <div className="font-label" style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>{t_ticket("paid")}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: tokens.colors.brand }}>HK${totalPrice}</div>
                </div>
                <div>
                  <div className="font-label" style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>{t_ticket("payment")}</div>
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
                  data={memberCode}
                  size={QR_PX}
                  enlargeLabel={t_ticket("qr_tap_enlarge")}
                  closeLabel={t_ticket("close")}
                />
              </div>

              <div
                className="font-code"
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.6)",
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

              <div style={{ display: "flex", gap: 12, position: "relative" }}>
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
                  onClick={() => { setShareOpen((o) => !o); setShareError(null) }}
                  data-cms-key="book.ticket.share"
                  disabled={shareBusy}
                  aria-haspopup="menu"
                  aria-expanded={shareOpen}
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
                    cursor: shareBusy ? "not-allowed" : "pointer",
                    opacity: shareBusy ? 0.55 : 1,
                  }}
                >
                  <Share2 size={15} />
                  {shareBusy ? t("share_loading") : t("share")}
                </button>

                <AnimatePresence>
                  {shareOpen && (
                    <motion.div
                      role="menu"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.12 }}
                      style={{
                        position: "absolute",
                        bottom: 52,
                        right: 0,
                        width: 192,
                        background: "#141414",
                        border: "1px solid rgba(255,255,255,0.18)",
                        borderRadius: 12,
                        padding: "6px 0",
                        zIndex: 50,
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setShareOpen(false); shareCardImage() }}
                        disabled={shareBusy}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 14px",
                          background: "none",
                          border: "none",
                          color: tokens.colors.text,
                          fontSize: 13,
                          cursor: shareBusy ? "not-allowed" : "pointer",
                          textAlign: "left",
                          width: "100%",
                        }}
                      >
                        <Download size={15} />
                        {t("share_ticket_image")}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setShareOpen(false); shareQrOnly() }}
                        disabled={shareBusy}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 14px",
                          background: "none",
                          border: "none",
                          color: tokens.colors.text,
                          fontSize: 13,
                          cursor: shareBusy ? "not-allowed" : "pointer",
                          textAlign: "left",
                          width: "100%",
                        }}
                      >
                        <QrCode size={15} />
                        {t("share_qr_image")}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setShareOpen(false); shareTextFallback() }}
                        disabled={shareBusy}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 14px",
                          background: "none",
                          border: "none",
                          color: tokens.colors.text,
                          fontSize: 13,
                          cursor: shareBusy ? "not-allowed" : "pointer",
                          textAlign: "left",
                          width: "100%",
                        }}
                      >
                        <FileText size={15} />
                        {t("share_copy")}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {shareError && (
                <div style={{ fontSize: 12, color: tokens.colors.danger, textAlign: "center", marginTop: 10 }}>{shareError}</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
