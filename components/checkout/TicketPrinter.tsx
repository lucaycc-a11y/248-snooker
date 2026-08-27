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
    const timer = window.setTimeout(() => setPrinted(true), 1450)
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
                size={78}
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
          width: min(100%, 420px);
          height: 606px;
          margin: 0 auto;
          perspective: 1200px;
          isolation: isolate;
        }

        .ticket-printer-ambient {
          position: absolute;
          inset: 0;
          border-radius: ${tokens.radius.card};
          background:
            radial-gradient(circle at 50% 22%, rgba(111, 91, 183, 0.26), transparent 40%),
            linear-gradient(155deg, #24203f 0%, #17152e 56%, #0b0b18 100%);
          opacity: 0.82;
          z-index: -1;
        }

        .ticket-printer-machine {
          position: absolute;
          top: 24px;
          left: 50%;
          width: min(380px, calc(100% - 24px));
          height: 66px;
          transform: translateX(-50%) rotateX(7deg) rotateY(-2deg);
          transform-style: preserve-3d;
          border: 1px solid rgba(255, 255, 255, 0.22);
          border-radius: 20px 20px 11px 11px;
          background: linear-gradient(165deg, #3a4655 0%, #131b2c 24%, #050912 78%);
          box-shadow: inset 0 8px 13px rgba(255, 255, 255, 0.12), 0 14px 18px rgba(0, 0, 0, 0.45);
          z-index: 4;
        }

        .ticket-printer-machine::after {
          content: "";
          position: absolute;
          right: -1px;
          bottom: -13px;
          left: -1px;
          height: 15px;
          border-radius: 0 0 16px 16px;
          background: linear-gradient(180deg, #263041, #101625);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-top: 0;
        }

        .ticket-printer-lid {
          position: absolute;
          inset: 6px 8px auto;
          height: 29px;
          border-radius: 14px 14px 6px 6px;
          background: linear-gradient(180deg, rgba(106, 126, 145, 0.34), rgba(12, 18, 30, 0.1));
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
          right: 38px;
          bottom: 8px;
          left: 38px;
          height: 6px;
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

        .ticket-printer-paper-wrap {
          position: absolute;
          top: 52px;
          left: 50%;
          width: min(304px, calc(100% - 48px));
          height: 530px;
          transform: translateX(-50%) translateY(-450px) rotateX(-5deg) scaleY(0.82);
          transform-origin: top center;
          z-index: 2;
          animation: ticket-paper-eject 1.45s ${tokens.easing.spring} forwards;
          pointer-events: none;
        }

        .ticket-printer-paper {
          position: relative;
          min-height: 530px;
          padding: 62px 22px 26px;
          overflow: hidden;
          color: #182033;
          background: #ffffff;
          border-radius: 2px;
          box-shadow: 0 20px 35px rgba(0, 0, 0, 0.34), 0 0 0 1px rgba(255, 255, 255, 0.34);
          transform: rotateY(1deg);
        }

        .ticket-paper-header {
          text-align: center;
        }

        .ticket-paper-logo {
          display: block;
          width: 104px;
          height: auto;
          margin: 0 auto 14px;
        }

        .ticket-paper-header h2 {
          margin: 0;
          color: #565d6d;
          font-size: 23px;
          font-weight: 800;
          letter-spacing: -0.045em;
        }

        .ticket-paper-header p {
          max-width: 220px;
          margin: 6px auto 0;
          color: #9aaac5;
          font-size: 13px;
          line-height: 1.35;
        }

        .ticket-paper-perforation {
          position: relative;
          height: 22px;
          margin: 26px -22px 20px;
          border-top: 1px dashed #d7dfed;
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
          gap: 18px;
        }

        .ticket-paper-detail-grid {
          margin-top: 17px;
        }

        .ticket-paper-label {
          display: block;
          margin-bottom: 4px;
          color: #667490;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .ticket-paper-code {
          display: block;
          color: #172035;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 14px;
          letter-spacing: 0.035em;
        }

        .ticket-paper-amount-block,
        .ticket-paper-status-block {
          text-align: right;
        }

        .ticket-paper-amount {
          display: block;
          color: #182033;
          font-size: 18px;
          line-height: 1.1;
          white-space: nowrap;
        }

        .ticket-paper-detail-grid strong {
          display: block;
          color: #172035;
          font-size: 13px;
          line-height: 1.4;
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
          gap: 11px;
          min-height: 52px;
          margin-top: 17px;
          padding: 10px 13px;
          border: 1px solid #e8edf5;
          border-radius: 12px;
          background: #f7f9fc;
        }

        .ticket-paper-holder-mark {
          display: inline-flex;
          width: 24px;
          height: 24px;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: #ffffff;
          background: #182033;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: -0.08em;
        }

        .ticket-paper-holder-copy {
          display: flex;
          min-width: 0;
          flex: 1;
          flex-direction: column;
          gap: 4px;
        }

        .ticket-paper-holder-copy > strong {
          overflow: hidden;
          color: #172035;
          font-size: 12px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ticket-paper-payment {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: #94a3bd;
          font-size: 10px;
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
          margin: 18px auto 6px;
          padding: 5px;
          border: 1px solid #e0e7f1;
          border-radius: 8px;
          background: #ffffff;
          pointer-events: auto;
        }

        .ticket-paper-qr-wrap :global(button) {
          pointer-events: auto;
        }

        .ticket-paper-qr-caption {
          color: #6d7d99;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 8px;
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
          background: linear-gradient(135deg, transparent 4px, #fff 0) 0 0 / 10px 10px repeat-x;
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
          0% { opacity: 0; transform: translateX(-50%) translateY(-450px) rotateX(-12deg) scaleY(0.82); }
          14% { opacity: 1; }
          74% { transform: translateX(-50%) translateY(12px) rotateX(-2deg) scaleY(1.02); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0) rotateX(-3deg) scaleY(1); }
        }

        @keyframes ticket-printer-pulse {
          0%, 100% { opacity: 0.55; transform: translateY(-50%) scale(0.86); }
          50% { opacity: 1; transform: translateY(-50%) scale(1.15); }
        }

        @media (max-width: 380px) {
          .ticket-printer-scene {
            height: 566px;
            transform: scale(0.91);
            transform-origin: top center;
            margin-bottom: -34px;
          }

          .ticket-printer-caption { width: 100%; }
        }

        @media (prefers-reduced-motion: reduce) {
          .ticket-printer-paper-wrap {
            animation: none;
            transform: translateX(-50%) translateY(0) rotateX(-3deg) scaleY(1);
          }

          .ticket-printer-status-light { animation: none; }
        }
      `}</style>
    </section>
  )
}
