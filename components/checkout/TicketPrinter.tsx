"use client"

import { useEffect, useState } from "react"
import { Printer, RotateCcw } from "lucide-react"
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
  locale: string
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

/**
 * The confirmation's physical-feeling reveal. The machine is deliberately CSS
 * 3D rather than a canvas/WebGL scene: it stays crisp on mobile, respects
 * reduced-motion preferences, and does not add another rendering dependency.
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
  locale,
}: TicketPrinterProps) {
  const t = useTranslations("ticket")
  const [replayKey, setReplayKey] = useState(0)
  const [printed, setPrinted] = useState(false)

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
        <div className="ticket-printer-glow" aria-hidden="true" />
        <div className="ticket-printer-machine" aria-hidden="true">
          <div className="ticket-printer-lid">
            <div className="ticket-printer-lid-highlight" />
          </div>
          <div className="ticket-printer-slot">
            <span className="ticket-printer-status-light" />
          </div>
          <div className="ticket-printer-front">
            <div className="ticket-printer-panel-line" />
            <div className="ticket-printer-panel-dot" />
            <Printer size={17} strokeWidth={1.6} />
          </div>
          <div className="ticket-printer-foot ticket-printer-foot-left" />
          <div className="ticket-printer-foot ticket-printer-foot-right" />
        </div>

        <div key={replayKey} className="ticket-printer-paper-wrap">
          <article className="ticket-printer-paper">
            <div className="ticket-paper-brand" aria-label="SPACE8">SPACE8</div>
            <div className="ticket-paper-rule" />
            <div className="ticket-paper-heading">
              <span data-cms-key="ticket.ticket_title">{t("ticket_title")}</span>
              <span className="ticket-paper-status" data-cms-key="ticket.confirmed">{t("confirmed")}</span>
            </div>
            <div className="ticket-paper-code" data-cms-key="ticket.booking_code">{bookingCode}</div>
            <div className="ticket-paper-grid">
              <div>
                <span className="ticket-paper-label" data-cms-key="ticket.date_time">{t("date_time")}</span>
                <strong>{formatDate(date, locale)}</strong>
                <strong>{startTime} – {endTime}</strong>
              </div>
              <div>
                <span className="ticket-paper-label" data-cms-key="ticket.room">{t("room")}</span>
                <strong>{roomName}</strong>
              </div>
              <div>
                <span className="ticket-paper-label" data-cms-key="ticket.amount">{t("amount")}</span>
                <strong>HK${totalPrice}</strong>
              </div>
              <div>
                <span className="ticket-paper-label" data-cms-key="ticket.holder">{t("holder")}</span>
                <strong>{holderName || "—"}</strong>
              </div>
            </div>
            <div className="ticket-paper-qr">
              <QRCode
                data={memberCode}
                size={92}
                enlargeLabel={t("qr_tap_enlarge")}
                closeLabel={t("close")}
              />
            </div>
            <div className="ticket-paper-qr-caption" data-cms-key="ticket.qr_label">{t("qr_label")}</div>
            <div className="ticket-paper-edge" aria-hidden="true" />
          </article>
        </div>
      </div>

      <div className="ticket-printer-caption">
        <div className="ticket-printer-confirmed">
          <span className="ticket-printer-check" aria-hidden="true">✓</span>
          <span data-cms-key="ticket.print_complete">{printed ? t("print_complete") : t("printing")}</span>
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
          width: min(100%, 350px);
          height: 420px;
          margin: 0 auto;
          perspective: 1100px;
          isolation: isolate;
        }

        .ticket-printer-glow {
          position: absolute;
          left: 12%;
          right: 12%;
          bottom: 30px;
          height: 92px;
          border-radius: 50%;
          background: rgba(37, 211, 102, 0.2);
          filter: blur(30px);
          transform: rotateX(70deg);
          opacity: 0.7;
        }

        .ticket-printer-machine {
          position: absolute;
          left: 50%;
          bottom: 44px;
          width: 286px;
          height: 228px;
          transform: translateX(-50%) rotateX(8deg) rotateY(-5deg);
          transform-style: preserve-3d;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 20px 20px 16px 16px;
          background: linear-gradient(145deg, #303030 0%, #171717 42%, #050505 100%);
          box-shadow:
            inset 14px 12px 24px rgba(255, 255, 255, 0.09),
            inset -14px -18px 28px rgba(0, 0, 0, 0.7),
            0 22px 26px rgba(0, 0, 0, 0.55);
          z-index: 3;
        }

        .ticket-printer-lid {
          position: absolute;
          left: 10px;
          top: -31px;
          width: 264px;
          height: 55px;
          border: 1px solid rgba(255, 255, 255, 0.23);
          border-radius: 18px 18px 8px 8px;
          background: linear-gradient(160deg, #454545, #151515 72%);
          transform: rotateX(16deg);
          transform-origin: bottom;
          box-shadow: inset 10px 8px 18px rgba(255, 255, 255, 0.1), 0 -7px 18px rgba(0, 0, 0, 0.35);
        }

        .ticket-printer-lid-highlight {
          position: absolute;
          left: 26px;
          right: 26px;
          top: 10px;
          height: 2px;
          border-radius: 99px;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
        }

        .ticket-printer-slot {
          position: absolute;
          left: 31px;
          top: 28px;
          width: 224px;
          height: 18px;
          border-radius: 4px;
          background: #000;
          border: 1px solid rgba(0, 0, 0, 0.8);
          box-shadow: inset 0 3px 7px rgba(0, 0, 0, 0.9), 0 1px rgba(255, 255, 255, 0.12);
          z-index: 5;
        }

        .ticket-printer-status-light {
          position: absolute;
          right: 10px;
          top: 6px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: ${tokens.colors.brand};
          box-shadow: 0 0 10px ${tokens.colors.brand}, 0 0 22px rgba(37, 211, 102, 0.8);
          animation: ticket-printer-pulse 1.7s ease-in-out infinite;
        }

        .ticket-printer-front {
          position: absolute;
          left: 35px;
          right: 35px;
          bottom: 29px;
          height: 70px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.38);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          background: linear-gradient(145deg, rgba(255, 255, 255, 0.09), rgba(0, 0, 0, 0.25));
          box-shadow: inset 0 8px 16px rgba(255, 255, 255, 0.03);
        }

        .ticket-printer-panel-line {
          position: absolute;
          left: 17px;
          top: 17px;
          width: 35px;
          height: 3px;
          border-radius: 99px;
          background: rgba(255, 255, 255, 0.2);
        }

        .ticket-printer-panel-dot {
          position: absolute;
          right: 17px;
          top: 16px;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: ${tokens.colors.brand};
          box-shadow: 0 0 8px ${tokens.colors.brand};
        }

        .ticket-printer-foot {
          position: absolute;
          bottom: -9px;
          width: 42px;
          height: 16px;
          border-radius: 4px 4px 11px 11px;
          background: #080808;
          box-shadow: 0 4px 5px rgba(0, 0, 0, 0.5);
        }

        .ticket-printer-foot-left { left: 28px; }
        .ticket-printer-foot-right { right: 28px; }

        .ticket-printer-paper-wrap {
          position: absolute;
          left: 50%;
          top: 62px;
          width: 226px;
          height: 306px;
          transform: translateX(-50%) translateY(-252px) rotateX(-4deg);
          transform-origin: bottom center;
          z-index: 2;
          animation: ticket-paper-eject 1.45s ${tokens.easing.spring} forwards;
          pointer-events: none;
        }

        .ticket-printer-paper {
          position: relative;
          width: 100%;
          min-height: 306px;
          padding: 15px 16px 22px;
          overflow: hidden;
          color: #101312;
          background: #fff;
          border-radius: 2px 2px 1px 1px;
          box-shadow: 0 12px 20px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.12);
          transform: rotateY(2deg);
        }

        .ticket-paper-brand {
          color: #101312;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.22em;
        }

        .ticket-paper-rule {
          height: 1px;
          margin: 8px 0 11px;
          background: rgba(16, 19, 18, 0.2);
        }

        .ticket-paper-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .ticket-paper-status {
          padding: 3px 5px;
          border-radius: 2px;
          color: #fff;
          background: #168c46;
          font-size: 7px;
        }

        .ticket-paper-code {
          margin-top: 8px;
          color: #168c46;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.02em;
        }

        .ticket-paper-grid {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 10px 8px;
          margin-top: 15px;
        }

        .ticket-paper-grid > div {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 2px;
        }

        .ticket-paper-label {
          color: #65706a;
          font-size: 7px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .ticket-paper-grid strong {
          overflow: hidden;
          font-size: 9px;
          line-height: 1.2;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ticket-paper-qr {
          display: flex;
          justify-content: center;
          margin-top: 13px;
          padding: 5px;
          border: 1px solid #dfe5e1;
          border-radius: 5px;
          background: #fff;
        }

        .ticket-paper-qr :global(button) {
          pointer-events: auto;
        }

        .ticket-paper-qr-caption {
          margin-top: 4px;
          color: #65706a;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 7px;
          text-align: center;
        }

        .ticket-paper-edge {
          position: absolute;
          bottom: -3px;
          left: 0;
          width: 100%;
          height: 7px;
          background: linear-gradient(135deg, transparent 4px, #fff 0) 0 0 / 10px 10px repeat-x;
        }

        .ticket-printer-caption {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          width: min(100%, 350px);
          margin: 0 auto;
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
          border-radius: 8px;
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
          0% { opacity: 0; transform: translateX(-50%) translateY(-252px) rotateX(-12deg) scaleY(0.72); }
          14% { opacity: 1; }
          74% { transform: translateX(-50%) translateY(12px) rotateX(-2deg) scaleY(1.02); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0) rotateX(-3deg) scaleY(1); }
        }

        @keyframes ticket-printer-pulse {
          0%, 100% { opacity: 0.55; transform: scale(0.86); }
          50% { opacity: 1; transform: scale(1.15); }
        }

        @media (max-width: 380px) {
          .ticket-printer-scene { height: 386px; transform: scale(0.91); transform-origin: top center; margin-bottom: -30px; }
          .ticket-printer-caption { width: 100%; }
        }

        @media (prefers-reduced-motion: reduce) {
          .ticket-printer-paper-wrap { animation: none; transform: translateX(-50%) translateY(0) rotateX(-3deg) scaleY(1); }
          .ticket-printer-status-light { animation: none; }
        }
      `}</style>
    </section>
  )
}
