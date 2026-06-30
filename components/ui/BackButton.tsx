"use client"

import type { CSSProperties, ReactNode } from "react"
import { ChevronLeft } from "lucide-react"

// Shared fixed top-left back arrow — the SINGLE source of truth for this control,
// extracted verbatim from the booking flow so /member and /book stay identical.
// Safe-area-aware, 44×44 tap target, white/glass. Renders an <a> when `href` is
// given (real navigation, SSR-friendly), otherwise a <button> for in-flow handlers.
const baseStyle: CSSProperties = {
  position: "fixed",
  top: "max(1rem, env(safe-area-inset-top, 0px))",
  left: "max(1rem, env(safe-area-inset-left, 0px))",
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
  zIndex: 60,
  textDecoration: "none",
}

export function BackButton({
  onClick,
  href,
  ariaLabel,
  color = "#fff",
  cmsKey,
  iconSize = 22,
}: {
  onClick?: () => void
  href?: string
  ariaLabel: string
  color?: string
  cmsKey?: string
  iconSize?: number
}) {
  const style = { ...baseStyle, color }
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
