"use client"

import type { CSSProperties, ReactNode } from "react"
import { ChevronLeft } from "lucide-react"

// Shared back arrow — the SINGLE source of truth for this control, extracted
// verbatim from the booking flow so /member and /book stay identical. Safe-
// area-aware, 44×44 tap target, white/glass. Renders an <a> when `href` is
// given (real navigation, SSR-friendly), otherwise a <button> for in-flow
// handlers. `variant="inline"` drops the fixed-overlay positioning so it can
// sit as a normal flex child (e.g. alongside /book's progress stepper) while
// keeping identical visual tokens to the default fixed placement.
const baseStyle: CSSProperties = {
  width: 44,
  height: 44,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 9999,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  cursor: "pointer",
  textDecoration: "none",
  flexShrink: 0,
}

const fixedStyle: CSSProperties = {
  position: "fixed",
  top: "max(1rem, env(safe-area-inset-top, 0px))",
  left: "max(1rem, env(safe-area-inset-left, 0px))",
  zIndex: 60,
}

export function BackButton({
  onClick,
  href,
  ariaLabel,
  color = "#fff",
  cmsKey,
  iconSize = 22,
  variant = "fixed",
}: {
  onClick?: () => void
  href?: string
  ariaLabel: string
  color?: string
  cmsKey?: string
  iconSize?: number
  variant?: "fixed" | "inline"
}) {
  const style = { ...baseStyle, ...(variant === "fixed" ? fixedStyle : {}), color }
  const icon: ReactNode = <ChevronLeft size={iconSize} />
  if (href) {
    return (
      <a href={href} aria-label={ariaLabel} data-cms-key={cmsKey} className="book-back-arrow" style={style}>
        {icon}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} data-cms-key={cmsKey} className="book-back-arrow" style={style}>
      {icon}
    </button>
  )
}
