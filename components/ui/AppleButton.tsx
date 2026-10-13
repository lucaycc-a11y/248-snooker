"use client"

import { Link } from "@/i18n/navigation"
import { tokens } from "@/app/styles/tokens"
import "./AppleButton.css"

export interface AppleButtonProps {
  variant: "primary" | "secondary" | "link"
  size?: "md" | "lg"
  theme: "light" | "dark"
  accent?: string
  href?: string
  onClick?: () => void
  children: React.ReactNode
  className?: string
  disabled?: boolean
}

export function AppleButton({
  variant,
  size = "md",
  theme,
  accent,
  href,
  onClick,
  children,
  className = "",
  disabled = false,
}: AppleButtonProps) {
  const isDark = theme === "dark"

  const sizeStyles = {
    md: {
      height: 44,
      fontSize: 16,
      padding: "0 24px",
    },
    lg: {
      height: 52,
      fontSize: 17,
      padding: "0 28px",
    },
  }[size]

  const variantStyles = (() => {
    if (variant === "primary") {
      const bg = accent
        ? `linear-gradient(180deg, ${accent}, ${adjustColorDarker(accent, 8)})`
        : `linear-gradient(180deg, ${tokens.colors.green[700]}, ${tokens.colors.green[800]})`
      return {
        background: bg,
        color: "#ffffff",
        border: "none",
      }
    }

    if (variant === "secondary") {
      return {
        background: "transparent",
        color: isDark ? tokens.colors.text : "#111110",
        border: isDark ? "rgba(255,255,255,0.18)" : "rgba(17,17,16,0.22)",
      }
    }

    return {
      background: "transparent",
      color: isDark ? tokens.colors.green[600] : tokens.colors.green[700],
      border: "none",
    }
  })()

  const baseStyles: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: variant === "link" ? 4 : 8,
    height: variant === "link" ? "auto" : sizeStyles.height,
    fontSize: sizeStyles.fontSize,
    fontWeight: 600,
    padding: variant === "link" ? 0 : sizeStyles.padding,
    borderRadius: variant === "link" ? 0 : tokens.radius.pill,
    textDecoration: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: `all ${tokens.duration.fast} ${tokens.easing.spring}`,
    border: variantStyles.border ? `1px solid ${variantStyles.border}` : "none",
    background: variantStyles.background,
    color: disabled ? (isDark ? "rgba(255,255,255,0.3)" : "rgba(17,17,16,0.3)") : variantStyles.color,
    opacity: disabled ? 0.5 : 1,
    pointerEvents: disabled ? "none" : "auto",
    fontFamily: /^[a-zA-Z0-9\s\-.,!?'"]+$/.test(String(children))
      ? tokens.font.display
      : tokens.font.sans,
  }

  const linkChevron = variant === "link" && (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      style={{ marginLeft: 2 }}
    >
      <path
        d="M4.5 2L8.5 6L4.5 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )

  const commonProps = {
    style: baseStyles,
    className: `apple-button apple-button--${variant} apple-button--${theme} ${className}`,
    onClick: disabled ? undefined : onClick,
    "aria-disabled": disabled,
  }

  if (href && !disabled) {
    return (
      <Link href={href} {...commonProps}>
        {children}
        {linkChevron}
      </Link>
    )
  }

  return (
    <button type="button" {...commonProps} disabled={disabled}>
      {children}
      {linkChevron}
    </button>
  )
}

function adjustColorDarker(hex: string, percent: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)

  const rNorm = r / 255
  const gNorm = g / 255
  const bNorm = b / 255

  const max = Math.max(rNorm, gNorm, bNorm)
  const min = Math.min(rNorm, gNorm, bNorm)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case rNorm:
        h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6
        break
      case gNorm:
        h = ((bNorm - rNorm) / d + 2) / 6
        break
      case bNorm:
        h = ((rNorm - gNorm) / d + 4) / 6
        break
    }
  }

  const newL = Math.max(0, l - percent / 100)

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  let rOut: number, gOut: number, bOut: number
  if (s === 0) {
    rOut = gOut = bOut = newL
  } else {
    const q = newL < 0.5 ? newL * (1 + s) : newL + s - newL * s
    const p = 2 * newL - q
    rOut = hue2rgb(p, q, h + 1 / 3)
    gOut = hue2rgb(p, q, h)
    bOut = hue2rgb(p, q, h - 1 / 3)
  }

  const toHex = (c: number) =>
    Math.round(c * 255)
      .toString(16)
      .padStart(2, "0")

  return `#${toHex(rOut)}${toHex(gOut)}${toHex(bOut)}`
}
