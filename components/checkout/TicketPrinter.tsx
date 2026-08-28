"use client"

import { useEffect, useState } from "react"
import { RotateCcw } from "lucide-react"
import { useTranslations } from "next-intl"
import { tokens } from "@/app/styles/tokens"
import { QRCode } from "@/components/shared/QRCode"

type TicketPrinterProps = {
  date: string
  startTime: string
  endTime: string
  roomName: string
  bookingCode: string
  memberCode: string
  totalPrice: number
  holderName: string | null
  paymentMethod?: string | null
  locale: string
}

const PAYMENT_ICON_MAP: Record<string, string> = {
  card: "/icons/payment/cnp-visa.png",
  fps: "/icons/payment/fps.png",
  payme: "/icons/payment/payme.png",
  octopus: "/icons/payment/octopus-card.png",
  alipay: "/icons/payment/alipaycn.png",
  alipayhk: "/icons/payment/alipayhk.png",
  wechat: "/icons/payment/wechat.png",
  unionpay_qp: "/icons/payment/cloud.png",
  apple_pay: "/icons/payment/apple.png",
  google_pay: "/icons/payment/google.png",
}

function formatDate(date: string, locale: string): string {
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return date
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed)
}

function paymentKey(method: string | null | undefined): string {
  if (!method) return "card"
  return method.replace(/-/g, "_").toLowerCase()
}

/**
 * A physical-feeling boarding-pass reveal for the confirmation screen. The
 * machine is CSS 3D so the ticket stays crisp on mobile without another
 * rendering dependency, while the QR remains the shared scannable component.
 */
export function TicketPrinter({
  date,
  startTime,
  endTime,
  roomName,
  bookingCode,
  memberCode,
  totalPrice,
  holderName,
  paymentMethod,
  locale,
}: TicketPrinterProps) {
  const t = useTranslations("ticket")
  const [replayKey, setReplayKey] = useState(0)
  const [printed, setPrinted] = useState(false)
  const selectedPaymentKey = paymentKey(paymentMethod)
  const paymentIcon = PAYMENT_ICON_MAP[selectedPaymentKey] ?? PAYMENT_ICON_MAP.card
  const paymentLabel = t(`payment_${selectedPaymentKey}`)

  useEffect(() => {
    setPrinted(false)
    const timer = window.setTimeout(() => setPrinted(true), 2500)
    return () => window.clearTimeout(timer)
  }, [replayKey])

  return (
    <section
      className={`ticket-printer-stage${printed ? " is-printed" : ""}`}
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
          <div key={replayKey} className="ticket-printer-paper-wrap">
            <article className="ticket-printer-paper">
            <div className="ticket-paper-header">
              {/* The local SVG keeps the Space8 mark crisp on the white ticket. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="ticket-paper-logo"
                src="/logos/logo-black-horizontal.svg"
                alt="Space8"
              />
              <h2 data-cms-key="ticket.ticket_title">{t("ticket_title")}</h2>
              <p data-cms-key="ticket.ticket_subtitle">{t("ticket_subtitle", { room: roomName })}</p>
            </div>

            <div className="ticket-paper-perforation" aria-hidden="true" />

            <div className="ticket-paper-main-grid">
              <div>
                <span className="ticket-paper-label" data-cms-key="ticket.booking_pass">
                  {t("booking_pass")}
                </span>
                <strong className="ticket-paper-code" data-cms-key="ticket.booking_code">
                  {bookingCode}
                </strong>
              </div>
              <div className="ticket-paper-amount-block">
                <span className="ticket-paper-label" data-cms-key="ticket.amount">
                  {t("amount")}
                </span>
                <strong className="ticket-paper-amount">HK${totalPrice.toFixed(2)}</strong>
              </div>
            </div>

            <div className="ticket-paper-detail-grid">
              <div>
                <span className="ticket-paper-label" data-cms-key="ticket.date_time">
                  {t("date_time")}
                </span>
                <strong>{formatDate(date, locale)}</strong>
                <strong>{startTime} – {endTime}</strong>
              </div>
              <div className="ticket-paper-status-block">
                <span className="ticket-paper-label" data-cms-key="ticket.status">
                  {t("status")}
                </span>
                <strong className="ticket-paper-status" data-cms-key="ticket.confirmed">
                  {t("confirmed")}
                </strong>
              </div>
            </div>

            <div className="ticket-paper-holder">
              <span className="ticket-paper-holder-mark" aria-hidden="true">S8</span>
              <div className="ticket-paper-holder-copy">
                <strong>{holderName || t("holder_fallback")}</strong>
                <span className="ticket-paper-payment">
                  <img src={paymentIcon} alt="" aria-hidden="true" />
                  <span>{paymentLabel}</span>
                </span>
              </div>
            </div>

            <div className="ticket-paper-qr-wrap">
              <QRCode
                data={memberCode}
                size={140}
                enlargeLabel={t("qr_tap_enlarge")}
                closeLabel={t("close")}
              />
            </div>
            <div className="ticket-paper-qr-caption" data-cms-key="ticket.qr_label">
              {t("qr_label")}
            </div>
            <div className="ticket-paper-edge" aria-hidden="true" />
            </article>
          </div>
        </div>
      </div>

      <div className="ticket-printer-caption">
        <div className="ticket-printer-confirmed">
          <span className="ticket-printer-check" aria-hidden="true">✓</span>
          <span data-cms-key="ticket.print_complete">
            {printed ? t("print_complete") : t("printing")}
          </span>
        </div>
        <button
          type="button"
          className="ticket-printer-replay"
          onClick={() => setReplayKey((key) => key + 1)}
          aria-label={t("reprint")}
          data-cms-key="ticket.reprint"
        >
          <RotateCcw size={14} aria-hidden="true" />
          {t("reprint")}
        </button>
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
          height: 716px;
          margin: 0 auto;
          overflow: hidden;
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
          height: 616px;
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
          height: 610px;
          transform: translateY(-600px) rotateX(-5deg) scaleY(0.72);
          transform-origin: top center;
          animation: ticket-paper-eject 2.5s steps(24, end) forwards;
          pointer-events: none;
        }

        .ticket-printer-paper {
          position: relative;
          min-height: 610px;
          padding: 72px 26px 30px;
          overflow: hidden;
          color: #34383e;
          background: #e8e9eb;
          border: 1px solid rgba(255, 255, 255, 0.85);
          border-radius: 2px;
          box-shadow: 0 20px 35px rgba(0, 0, 0, 0.42), 0 0 0 1px rgba(255, 255, 255, 0.16);
          transform: rotateY(1deg);
        }

        .ticket-paper-header {
          text-align: center;
        }

        .ticket-paper-logo {
          display: block;
          width: 116px;
          height: auto;
          margin: 0 auto 18px;
        }

        .ticket-paper-header h2 {
          margin: 0;
          color: #565b63;
          font-size: 27px;
          font-weight: 800;
          letter-spacing: -0.045em;
        }

        .ticket-paper-header p {
          max-width: 250px;
          margin: 8px auto 0;
          color: #a4b2c8;
          font-size: 14px;
          line-height: 1.35;
        }

        .ticket-paper-perforation {
          position: relative;
          height: 26px;
          margin: 30px -26px 24px;
          border-top: 1px dashed #cbd1d9;
        }

        .ticket-paper-perforation::before,
        .ticket-paper-perforation::after {
          content: "";
          position: absolute;
          top: -11px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #18162f;
        }

        .ticket-paper-perforation::before { left: -11px; }
        .ticket-paper-perforation::after { right: -11px; }

        .ticket-paper-main-grid,
        .ticket-paper-detail-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 22px;
        }

        .ticket-paper-detail-grid {
          margin-top: 21px;
        }

        .ticket-paper-label {
          display: block;
          margin-bottom: 5px;
          color: #7a8492;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .ticket-paper-code {
          display: block;
          color: #303841;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 16px;
          letter-spacing: 0.035em;
        }

        .ticket-paper-amount-block,
        .ticket-paper-status-block {
          text-align: right;
        }

        .ticket-paper-amount {
          display: block;
          color: #303841;
          font-size: 21px;
          line-height: 1.1;
          white-space: nowrap;
        }

        .ticket-paper-detail-grid strong {
          display: block;
          color: #303841;
          font-size: 15px;
          line-height: 1.45;
        }

        .ticket-paper-status {
          display: inline-block !important;
          padding: 3px 8px;
          border-radius: 999px;
          color: #168746 !important;
          background: #e8faf0;
          font-size: 10px !important;
          white-space: nowrap;
        }

        .ticket-paper-holder {
          display: flex;
          align-items: center;
          gap: 13px;
          min-height: 60px;
          margin-top: 21px;
          padding: 12px 15px;
          border: 1px solid #d9dee5;
          border-radius: 14px;
          background: #f3f4f6;
        }

        .ticket-paper-holder-mark {
          display: inline-flex;
          width: 28px;
          height: 28px;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: #ffffff;
          background: #29313b;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: -0.08em;
        }

        .ticket-paper-holder-copy {
          display: flex;
          min-width: 0;
          flex: 1;
          flex-direction: column;
          gap: 5px;
        }

        .ticket-paper-holder-copy > strong {
          overflow: hidden;
          color: #303841;
          font-size: 13px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ticket-paper-payment {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: #98a6b8;
          font-size: 11px;
        }

        .ticket-paper-payment img {
          display: block;
          width: auto;
          height: 14px;
          object-fit: contain;
        }

        .ticket-paper-qr-wrap {
          display: flex;
          width: fit-content;
          margin: 22px auto 8px;
          padding: 6px;
          border: 1px solid #d5dce4;
          border-radius: 9px;
          background: #f8f9fa;
          pointer-events: auto;
        }

        .ticket-paper-qr-wrap :global(button) {
          pointer-events: auto;
        }

        .ticket-paper-qr-caption {
          color: #7f8b9b;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 9px;
          letter-spacing: 0.16em;
          text-align: center;
          text-transform: uppercase;
        }

        .ticket-paper-edge {
          position: absolute;
          right: 0;
          bottom: -3px;
          left: 0;
          height: 7px;
          background: linear-gradient(135deg, transparent 4px, #e8e9eb 0) 0 0 / 10px 10px repeat-x;
        }

        .ticket-printer-caption {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          width: min(100%, 420px);
          margin: 12px auto 0;
        }

        .ticket-printer-confirmed {
          display: flex;
          align-items: center;
          gap: 8px;
          color: ${tokens.colors.textMuted};
          font-size: 12px;
        }

        .ticket-printer-check {
          display: inline-flex;
          width: 20px;
          height: 20px;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: #000;
          background: ${tokens.colors.brand};
          font-size: 13px;
          font-weight: 900;
        }

        .ticket-printer-replay {
          display: inline-flex;
          min-height: 36px;
          align-items: center;
          gap: 6px;
          padding: 0 11px;
          border: 1px solid ${tokens.colors.borderStrong};
          border-radius: ${tokens.radius.input};
          color: ${tokens.colors.textMuted};
          background: transparent;
          cursor: pointer;
          font: inherit;
          font-size: 12px;
        }

        .ticket-printer-replay:hover,
        .ticket-printer-replay:focus-visible {
          border-color: ${tokens.colors.brand};
          color: ${tokens.colors.brand};
          outline: none;
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
            height: 640px;
            transform: scale(0.91);
            transform-origin: top center;
            margin-bottom: -38px;
          }

          .ticket-printer-caption { width: 100%; }
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
