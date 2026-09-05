"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"

/**
 * Section 7 — Membership (refreshed)
 *
 * CSS-only animations + IntersectionObserver (no framer-motion).
 * Three tiers: Amateur (#86EFAC), Century (#E5E7EB), Maximum (#BFDBFE).
 *
 * Desktop: CSS Grid 3-column card layout.
 * Mobile: horizontal scroll-snap carousel with dot indicators + arrow nav.
 *
 * Modal: CSS transition on backdrop + dialog (no AnimatePresence).
 * CTA: `.pbtn-primary` shine-sweep from globals.css.
 */

const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Noto Sans TC", "Helvetica Neue", Helvetica, Arial, sans-serif'

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

/* ── Tier icons (inline SVG — no lucide-react dependency) ────────── */

function SparkleIcon() {
  return (
    <svg {...ICON_PROPS} width="100%" height="100%" aria-hidden="true">
      <path d="M12 3l1.912 5.813a2 2 0 001.272 1.275L21 12l-5.816 1.912a2 2 0 00-1.272 1.275L12 21l-1.912-5.813a2 2 0 00-1.272-1.275L3 12l5.816-1.912a2 2 0 001.272-1.275L12 3z" />
    </svg>
  )
}

function TrophyIcon() {
  return (
    <svg {...ICON_PROPS} width="100%" height="100%" aria-hidden="true">
      <path d="M6 9H4a2 2 0 01-2-2V5a2 2 0 012-2h2M18 9h2a2 2 0 002-2V5a2 2 0 00-2-2h-2M6 3h12v6a6 6 0 01-12 0V3zM12 15v3M8 21h8M10 18h4" />
    </svg>
  )
}

function GemIcon() {
  return (
    <svg {...ICON_PROPS} width="100%" height="100%" aria-hidden="true">
      <path d="M6 3h12l4 6-10 13L2 9 6 3zM2 9h20M6.5 3L12 9M17.5 3L12 9" />
    </svg>
  )
}

/* ── Helpers ──────────────────────────────────────────────────────── */

/** Wrap each keyword in an accent-coloured span (Apple-style inline highlight) */
function highlight(text: string, words: string[], color: string): React.ReactNode {
  if (!words.length) return text
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  const parts = text.split(new RegExp(`(${escaped.join("|")})`, "g"))
  return parts.map((part, i) =>
    words.includes(part) ? (
      <span key={i} style={{ color, fontWeight: 600 }}>
        {part}
      </span>
    ) : (
      part
    ),
  )
}

/* ── Types ────────────────────────────────────────────────────────── */

interface TierCard {
  key: string
  icon: React.ReactNode
  accent: string
  title: string
  subtitle?: string
  badge?: string
  body: string
  highlights: string[]
  modalBody: string
}

interface ModalData {
  label: string
  title: string
  body: string
}

/* ── Main component ───────────────────────────────────────────────── */

export default function Member() {
  const t = useTranslations("member")
  const secRef = useRef<HTMLElement>(null)
  const [entered, setEntered] = useState(false)
  const [modal, setModal] = useState<ModalData | null>(null)
  const [activeDot, setActiveDot] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])

  const cards: TierCard[] = [
    {
      key: "tier_amateur",
      icon: <SparkleIcon />,
      accent: "#86EFAC",
      title: t("amateur_title"),
      body: t("amateur_body"),
      highlights: [t("amateur_highlight")],
      modalBody: t("amateur_modal_body"),
    },
    {
      key: "tier_century",
      icon: <TrophyIcon />,
      accent: "#E5E7EB",
      title: t("century_title"),
      subtitle: t("century_subtitle"),
      body: t("century_body"),
      highlights: [t("century_highlight1"), t("century_highlight2")],
      modalBody: t("century_modal_body"),
    },
    {
      key: "tier_maximum",
      icon: <GemIcon />,
      accent: "#BFDBFE",
      title: t("maximum_title"),
      subtitle: t("maximum_subtitle"),
      badge: t("maximum_badge"),
      body: t("maximum_body"),
      highlights: [
        t("maximum_highlight1"),
        t("maximum_highlight2"),
        t("maximum_highlight3"),
      ],
      modalBody: t("maximum_modal_body"),
    },
  ]

  /* ── IntersectionObserver entrance ──────────────────────────────── */

  useEffect(() => {
    const el = secRef.current
    if (!el) return
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      setEntered(true)
      return
    }
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setEntered(true)
          obs.unobserve(e.target)
        }
      },
      { threshold: 0.15 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  /* ── Mobile carousel scroll tracking ────────────────────────────── */

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const onScroll = () => {
      const center = track.scrollLeft + track.clientWidth / 2
      let nearest = 0
      let min = Infinity
      cardRefs.current.forEach((el, i) => {
        if (!el) return
        const cardCenter = el.offsetLeft + el.offsetWidth / 2
        const dist = Math.abs(cardCenter - center)
        if (dist < min) {
          min = dist
          nearest = i
        }
      })
      setActiveDot(nearest)
    }
    track.addEventListener("scroll", onScroll, { passive: true })
    return () => track.removeEventListener("scroll", onScroll)
  }, [])

  /* ── Carousel navigation ────────────────────────────────────────── */

  const scrollToCard = useCallback(
    (i: number) => {
      const el = cardRefs.current[i]
      const track = trackRef.current
      if (!el || !track) return
      track.scrollTo({ left: el.offsetLeft - 24, behavior: "smooth" })
    },
    [],
  )

  const nudge = useCallback(
    (dir: -1 | 1) => {
      const next = Math.min(cards.length - 1, Math.max(0, activeDot + dir))
      scrollToCard(next)
    },
    [activeDot, cards.length, scrollToCard],
  )

  /* ── Modal body scroll lock ─────────────────────────────────────── */

  useEffect(() => {
    if (modal) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [modal])

  /* ── Escape key to close modal ──────────────────────────────────── */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  return (
    <section
      ref={secRef}
      data-nav-theme="dark"
      aria-labelledby="s7-title"
      className="s7-section"
      data-cms-key="member.title"
    >
      <div className="s7-inner">
        {/* ── Header ── */}
        <h2
          id="s7-title"
          className={`s7-title ${entered ? "s7-title--in" : ""}`}
          data-cms-key="member.title"
        >
          {t("title")}。
        </h2>
        <Link
          href="/membership"
          className={`s7-cta-link ${entered ? "s7-cta-link--in" : ""}`}
          data-cms-key="member.cta_join"
        >
          <span>{t("cta_join")}</span>
          <span aria-hidden="true">›</span>
        </Link>
      </div>

      {/* ── Desktop: CSS Grid ── */}
      <div className="s7-grid" aria-label="Membership tiers">
        {cards.map((card, i) => (
          <TierCardComponent
            key={card.key}
            card={card}
            index={i}
            entered={entered}
            onExpand={(data) => setModal(data)}
            cardRef={(el) => {
              cardRefs.current[i] = el
            }}
            t={t}
          />
        ))}
      </div>

      {/* ── Mobile: Scroll-snap carousel ── */}
      <div ref={trackRef} className="s7-carousel" aria-label="Membership tiers">
        {cards.map((card, i) => (
          <div key={card.key} className="s7-slide">
            <TierCardComponent
              card={card}
              index={i}
              entered={entered}
              onExpand={(data) => setModal(data)}
              cardRef={(el) => {
                cardRefs.current[i] = el
              }}
              t={t}
              carousel
            />
          </div>
        ))}
      </div>

      {/* ── Mobile controls: arrows + dot indicators ── */}
      <div className="s7-controls">
        {/* Left arrow */}
        <button
          type="button"
          onClick={() => nudge(-1)}
          aria-label="Previous"
          className="s7-arrow"
        >
          ‹
        </button>

        {/* Dot indicators — 8px visual dot inside a 44px-tall tap target */}
        <div className="s7-dots">
          {cards.map((card, i) => (
            <button
              key={card.key}
              type="button"
              onClick={() => scrollToCard(i)}
              aria-label={`Go to tier ${i + 1}`}
              className="s7-dot-btn"
            >
              <span
                className={`s7-dot ${i === activeDot ? "s7-dot--active" : ""}`}
                style={
                  {
                    "--dot-color": card.accent,
                  } as React.CSSProperties
                }
              />
            </button>
          ))}
        </div>

        {/* Right arrow */}
        <button
          type="button"
          onClick={() => nudge(1)}
          aria-label="Next"
          className="s7-arrow"
        >
          ›
        </button>
      </div>

      {/* ── Modal ── */}
      {modal && (
        <div
          className={`s7-modal-backdrop ${modal ? "s7-modal-backdrop--open" : ""}`}
          onClick={() => setModal(null)}
          role="dialog"
          aria-modal="true"
          aria-label={modal.label}
        >
          <div
            className={`s7-modal ${modal ? "s7-modal--open" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setModal(null)}
              aria-label={t("close_modal")}
              className="s7-modal-close"
            >
              ×
            </button>
            <p
              className="s7-modal-label"
              data-cms-key="member.modal_label"
            >
              {modal.label}
            </p>
            <h3
              className="s7-modal-title"
              data-cms-key="member.title"
            >
              {modal.title}
            </h3>
            <p
              className="s7-modal-body"
              data-cms-key="member.amateur_modal_body"
            >
              {modal.body}
            </p>
            <Link
              href="/membership"
              className="s7-modal-link"
              data-cms-key="member.cta_learn"
            >
              <span>{t("cta_learn")}</span>
              <span aria-hidden="true">›</span>
            </Link>
          </div>
        </div>
      )}

      {/* ── Scoped section layout styles ── */}
      <style jsx>{`
        .s7-section {
          background: #1d1d1f;
          padding: clamp(88px, 12vw, 140px) 0;
          overflow: hidden;
        }
        .s7-inner {
          max-width: 1000px;
          margin: 0 auto;
          padding: 0 24px;
          margin-bottom: clamp(40px, 5vw, 56px);
        }
        .s7-title {
          font-family: ${FONT_FAMILY};
          font-size: clamp(32px, 5vw, 56px);
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.1;
          color: #a1a1a6;
          margin: 0 0 12px;
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1),
            transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .s7-title--in {
          opacity: 1;
          transform: none;
        }
        .s7-cta-link {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          color: #22c55e;
          font-family: ${FONT_FAMILY};
          font-size: 19px;
          text-decoration: none;
          white-space: nowrap;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s,
            transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s;
        }
        .s7-cta-link--in {
          opacity: 1;
          transform: none;
        }
        .s7-cta-link:hover {
          text-decoration: underline;
        }
        .s7-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          max-width: 1000px;
          margin: 0 auto;
          padding: 0 24px;
          align-items: stretch;
        }
        .s7-carousel {
          display: none;
        }
        .s7-controls {
          display: none;
        }
        @media (max-width: 1023px) {
          .s7-grid {
            display: none;
          }
          .s7-carousel {
            display: flex;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
            touch-action: pan-x pan-y;
            gap: 16px;
            padding: 8px 16px;
            scroll-padding-left: 16px;
          }
          .s7-carousel::-webkit-scrollbar {
            display: none;
          }
          .s7-slide {
            flex: 0 0 88vw;
            max-width: 440px;
            scroll-snap-align: start;
            scroll-snap-stop: always;
          }
          .s7-controls {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 16px;
            margin-top: 32px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .s7-title,
          .s7-cta-link {
            opacity: 1;
            transform: none;
          }
        }
      `}</style>

      {/* ── Card + modal global styles ── */}
      <style jsx global>{`
        /* ── Tier card ── */
        .s7-card {
          position: relative;
          background: #2d2d2d;
          border: 1px solid #3d3d3d;
          border-radius: 24px;
          padding: 32px;
          padding-bottom: 80px;
          display: flex;
          flex-direction: column;
          min-height: 360px;
          opacity: 0;
          transform: translateY(20px) scale(0.96);
          transition:
            opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1),
            transform 0.6s cubic-bezier(0.16, 1, 0.3, 1),
            border-color 0.3s ease,
            box-shadow 0.3s ease;
        }
        .s7-card--in {
          opacity: 1;
          transform: none;
        }
        .s7-card:hover {
          border-color: #4d4d4d;
          box-shadow: 0 24px 56px -20px rgba(0, 0, 0, 0.5);
        }
        .s7-card-badge {
          position: absolute;
          top: 24px;
          right: 24px;
          font-family: ${FONT_FAMILY};
          font-size: 11px;
          font-weight: 600;
          border-radius: 100px;
          padding: 4px 10px;
          white-space: nowrap;
        }
        .s7-card-icon {
          width: 44px;
          height: 44px;
          margin-bottom: 24px;
        }
        .s7-card-title {
          font-family: ${FONT_FAMILY};
          font-size: 26px;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #ffffff;
          margin: 0 0 4px;
        }
        .s7-card-subtitle {
          font-family: ${FONT_FAMILY};
          font-size: 15px;
          font-weight: 500;
          margin: 0 0 16px;
        }
        .s7-card-body {
          font-family: ${FONT_FAMILY};
          font-size: 15px;
          line-height: 1.6;
          color: rgba(245, 245, 245, 0.7);
          margin: 0;
        }
        .s7-card-body--offset {
          margin-top: 12px;
        }
        .s7-card-expand {
          position: absolute;
          bottom: 24px;
          right: 24px;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 1.5px solid rgba(255, 255, 255, 0.25);
          background: rgba(255, 255, 255, 0.15);
          color: #ffffff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          transition:
            transform 0.25s cubic-bezier(0.16, 1, 0.3, 1),
            background 0.2s ease;
        }
        .s7-card-expand:hover {
          transform: scale(1.08);
          background: rgba(255, 255, 255, 0.22);
        }
        .s7-card-expand:active {
          transform: scale(0.96);
        }

        /* ── Carousel cards: suppress vertical y-entrance ── */
        .s7-slide .s7-card {
          transform: scale(0.95);
        }
        .s7-slide .s7-card--in {
          transform: none;
        }

        /* ── Arrow buttons ── */
        .s7-arrow {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          background: #2d2d2d;
          color: #ffffff;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          flex-shrink: 0;
          transition: background 0.2s ease, transform 0.2s ease;
        }
        .s7-arrow:hover {
          background: #3a3a3a;
          transform: scale(1.05);
        }
        .s7-arrow:active {
          transform: scale(0.95);
        }

        /* ── Dot indicators ── */
        .s7-dots {
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .s7-dot-btn {
          width: 24px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: none;
          cursor: pointer;
          padding: 0;
        }
        .s7-dot {
          display: block;
          width: 8px;
          height: 8px;
          border-radius: 100px;
          background: rgba(255, 255, 255, 0.25);
          transition: all 0.3s ease;
        }
        .s7-dot--active {
          width: 24px;
          background: var(--dot-color, #ffffff);
        }

        /* ── Modal backdrop ── */
        .s7-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(0, 0, 0, 0);
          backdrop-filter: blur(0px);
          -webkit-backdrop-filter: blur(0px);
          opacity: 0;
          pointer-events: none;
          transition:
            background 0.25s ease,
            backdrop-filter 0.25s ease,
            opacity 0.25s ease;
        }
        .s7-modal-backdrop--open {
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          opacity: 1;
          pointer-events: auto;
        }

        /* ── Modal dialog ── */
        .s7-modal {
          position: relative;
          width: 100%;
          max-width: 520px;
          background: #1d1d1f;
          border: 1px solid #2d2d2d;
          border-radius: 24px;
          padding: 40px;
          color: #ffffff;
          font-family: ${FONT_FAMILY};
          opacity: 0;
          transform: scale(0.9) translateY(20px);
          transition:
            opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1),
            transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .s7-modal--open {
          opacity: 1;
          transform: none;
        }
        .s7-modal-close {
          position: absolute;
          top: 20px;
          right: 20px;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: none;
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s ease;
        }
        .s7-modal-close:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        .s7-modal-label {
          font-size: 13px;
          font-weight: 500;
          color: #22c55e;
          margin: 0 0 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .s7-modal-title {
          font-size: 32px;
          font-weight: 600;
          letter-spacing: -0.02em;
          margin: 0 0 16px;
          color: #ffffff;
        }
        .s7-modal-body {
          font-size: 17px;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.75);
          margin: 0 0 24px;
        }
        .s7-modal-link {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          color: #22c55e;
          font-size: 17px;
          text-decoration: none;
          transition: text-decoration 0.2s ease;
        }
        .s7-modal-link:hover {
          text-decoration: underline;
        }

        /* ── Screen reader only (full tier text) ── */
        .s7-sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        @media (prefers-reduced-motion: reduce) {
          .s7-card {
            opacity: 1;
            transform: none;
          }
          .s7-slide .s7-card,
          .s7-slide .s7-card--in {
            transform: none;
          }
          .s7-modal-backdrop {
            transition: none;
          }
          .s7-modal {
            transition: none;
          }
        }
      `}</style>
    </section>
  )
}

/* ── TierCard sub-component ────────────────────────────────────────── */

function TierCardComponent({
  card,
  index,
  entered,
  onExpand,
  cardRef,
  t,
  carousel = false,
}: {
  card: TierCard
  index: number
  entered: boolean
  onExpand: (data: ModalData) => void
  cardRef: (el: HTMLDivElement | null) => void
  t: ReturnType<typeof useTranslations>
  carousel?: boolean
}) {
  const delay = index * 0.1

  return (
    <div
      ref={cardRef}
      className={`s7-card ${entered ? "s7-card--in" : ""}`}
      style={{
        transitionDelay: `${delay}s`,
      }}
    >
      {/* Badge */}
      {card.badge && (
        <span
          className="s7-card-badge"
          style={{
            color: card.accent,
            background: `${card.accent}1F`,
            border: `1px solid ${card.accent}59`,
          }}
          data-cms-key="member.maximum_badge"
        >
          {card.badge}
        </span>
      )}

      {/* Icon */}
      <div className="s7-card-icon" style={{ color: card.accent }}>
        {card.icon}
      </div>

      {/* Title */}
      <h3
        className="s7-card-title"
        data-cms-key={`member.${card.key.replace("tier_", "")}_title`}
      >
        {card.title}
      </h3>

      {/* Subtitle */}
      {card.subtitle && (
        <p
          className="s7-card-subtitle"
          style={{ color: card.accent }}
          data-cms-key={`member.${card.key.replace("tier_", "")}_subtitle`}
        >
          {card.subtitle}
        </p>
      )}

      {/* Body */}
      <p
        className={`s7-card-body ${!card.subtitle ? "s7-card-body--offset" : ""}`}
        data-cms-key={`member.${card.key.replace("tier_", "")}_body`}
      >
        {highlight(card.body, card.highlights, card.accent)}
      </p>

      {/* Full tier description in initial HTML (visually hidden) for crawlers/screen readers */}
      <p className="s7-sr-only">{card.modalBody}</p>

      {/* + expand button */}
      <button
        type="button"
        onClick={() =>
          onExpand({
            label: t("modal_label"),
            title: card.title,
            body: card.modalBody,
          })
        }
        aria-label={`Expand "${card.title}" details`}
        className="s7-card-expand"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M8 3v10M3 8h10" />
        </svg>
      </button>
    </div>
  )
}
