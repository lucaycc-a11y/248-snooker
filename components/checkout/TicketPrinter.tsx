"use client"

import { useTranslations } from "next-intl"
import { tokens } from "@/app/styles/tokens"
import { TicketCard } from "@/components/booking/TicketCard"

type TicketPrinterProps = {
  date: string
  startHour: number
  duration: number
  tableNumber: number
  bookingRef: string
  humanCode?: string
  memberCode: string
  totalPrice: number
  paymentMethod?: string | null
}

/**
 * A physical-feeling boarding-pass reveal for the confirmation screen. The
 * machine is CSS 3D so the ticket stays crisp on mobile without another
 * rendering dependency, while the QR remains the shared scannable component.
 */
export function TicketPrinter({
  date,
  startHour,
  duration,
  tableNumber,
  bookingRef,
  humanCode,
  memberCode,
  totalPrice,
  paymentMethod,
}: TicketPrinterProps) {
  const t = useTranslations("ticket")

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
            <TicketCard
              date={date}
              startHour={startHour}
              duration={duration}
              tableNumber={tableNumber}
              bookingRef={bookingRef}
              humanCode={humanCode}
              memberCode={memberCode}
              totalPrice={totalPrice}
              paymentMethod={paymentMethod}
              defaultExpanded
            />
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
          height: 716px;
          margin: 0 auto -96px;
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
            height: 640px;
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
