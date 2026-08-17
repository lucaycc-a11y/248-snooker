"use client"

// ────────────────────────────────────────────────────────────────
// PaymentMethodCard — one selectable (or disabled) payment method
// row. Visual spec mirrors the approved black-theme demo
// (space8-payment-method-preview-black.html):
//
//   · selected  →  card background flips to --green, radio becomes a
//                  solid white dot with a bounce (cubic-bezier(.34,1.56,.64,1))
//   · disabled  →  opacity 0.45, cursor not-allowed, pointer-events
//                  none (no hover), radio replaced by a muted lock/
//                  dash glyph, sublabel swapped for disabledReason
//                  ("即將推出" by default) in grey — not error red.
//
// Colours come from the tokens module (same Space8 design system
// that already drives KPayPayment.tsx). Never display:none — the
// card always stays in the list.
// ────────────────────────────────────────────────────────────────

import type { CSSProperties, ReactNode } from "react"
import { tokens } from "@/app/styles/tokens"

const GREEN = "#1a9d5c"
const GREEN_BRIGHT = "#22b86b"
const EASE_SPRING = "cubic-bezier(.34,1.56,.64,1)"
const EASE_STANDARD = "cubic-bezier(.2,.7,.3,1)"

const cardBase: CSSProperties = {
  minHeight: 56, // ≥44px tap target
  padding: "12px 16px",
  border: `1.5px solid ${tokens.colors.border}`,
  borderRadius: 16,
  background: tokens.colors.surface,
  color: tokens.colors.text,
  fontWeight: 600,
  fontSize: 15,
  display: "flex",
  alignItems: "center",
  gap: 14,
  width: "100%",
  textAlign: "left",
  fontFamily: tokens.font.sans,
}

type PaymentMethodCardProps = {
  /** Value passed to onSelect when pressed (id from the method config). */
  method: string
  label: string
  sublabel: string
  /** Right-hand icon badges (VISA/MC/G Pay/…) — React node from the method list. */
  icons: ReactNode
  selected: boolean
  /** true → fully inert: opacity 0.45, not-allowed, no hover, no onSelect. */
  disabled?: boolean
  /** Text shown instead of sublabel when disabled. Defaults to "即將推出". */
  disabledReason?: string
  onSelect: (method: string) => void
}

export default function PaymentMethodCard({
  method,
  label,
  sublabel,
  icons,
  selected,
  disabled = false,
  disabledReason = "即將推出",
  onSelect,
}: PaymentMethodCardProps) {
  if (disabled) {
    return (
      <div
        role="presentation"
        aria-disabled="true"
        style={{
          ...cardBase,
          opacity: 0.45,
          cursor: "not-allowed",
          pointerEvents: "none",
          borderColor: tokens.colors.border,
          background: tokens.colors.surface,
        }}
      >
        {/* Disabled glyph — muted dash instead of the radio */}
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="10" cy="10" r="8.5" stroke={tokens.colors.textFaint} strokeWidth="1.5" />
          <path d="M6.5 10h7" stroke={tokens.colors.textFaint} strokeWidth="1.5" strokeLinecap="round" />
        </svg>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: tokens.colors.text }}>{label}</div>
          {/* Disabled reason — muted grey "coming soon", NOT error red */}
          <div style={{ fontSize: 11.5, color: tokens.colors.textFaint, marginTop: 2 }}>
            {disabledReason}
          </div>
        </div>

        {icons ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, opacity: 0.6 }}>
            {icons}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(method)}
      aria-pressed={selected}
      style={{
        ...cardBase,
        cursor: "pointer",
        borderColor: selected ? GREEN_BRIGHT : tokens.colors.border,
        background: selected ? GREEN : tokens.colors.surface,
        color: selected ? "#fff" : tokens.colors.text,
        transform: selected ? "translateY(-1px)" : "none",
        transition: [
          `border-color 0.28s ${EASE_STANDARD}`,
          `background 0.28s ${EASE_STANDARD}`,
          `transform 0.32s ${EASE_SPRING}`,
        ].join(", "),
      }}
      onMouseEnter={(e) => {
        if (selected) return
        ;(
          e.currentTarget as HTMLButtonElement
        ).style.borderColor = tokens.colors.textFaint
        ;(e.currentTarget as HTMLButtonElement).style.background =
          "rgba(255,255,255,0.04)"
      }}
      onMouseLeave={(e) => {
        if (selected) return
        ;(
          e.currentTarget as HTMLButtonElement
        ).style.borderColor = tokens.colors.border
        ;(e.currentTarget as HTMLButtonElement).style.background =
          tokens.colors.surface
      }}
    >
      {/* Radio — white solid dot with bounce when selected */}
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          border: `2px solid ${selected ? "#fff" : tokens.colors.borderStrong}`,
          position: "relative",
          flexShrink: 0,
          transition: `border-color 0.25s cubic-bezier(.2,.7,.3,1)`,
          background: "transparent",
        }}
      >
        <span
          style={{
            position: "absolute",
            inset: 3,
            borderRadius: "50%",
            background: "#fff",
            transform: selected ? "scale(1)" : "scale(0)",
            transition: `transform 0.32s ${EASE_SPRING}`,
          }}
        />
      </span>

        <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: 15,
            fontWeight: 700,
            color: selected ? "#fff" : tokens.colors.text,
            transition: `color 0.25s ease`,
          }}
        >
          {label}
        </span>
        {sublabel && (
          <span
            style={{
              display: "block",
              fontSize: 11.5,
              color: selected ? "rgba(255,255,255,0.72)" : tokens.colors.textFaint,
              marginTop: 2,
              lineHeight: 1.4,
              transition: `color 0.25s ease`,
            }}
          >
            {sublabel}
          </span>
        )}
      </span>

      {icons ? (
        <span
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 4,
            flexShrink: 0,
            maxWidth: 160,
            justifyContent: "flex-end",
          }}
        >
          {icons}
        </span>
      ) : null}
    </button>
  )
}