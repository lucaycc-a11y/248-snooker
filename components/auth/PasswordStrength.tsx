"use client"

import { useEffect, useRef } from "react"
import { animate } from "animejs"
import { useTranslations } from "next-intl"
import { Check } from "lucide-react"
import { scorePassword, validatePassword, type PasswordReason } from "@/lib/auth/password"

const GREEN = "#22c55e"
const BAR_COLORS = ["#ef4444", "#ef4444", "#f59e0b", "#84cc16", GREEN] as const

type Rule = { reason: PasswordReason; labelKey: string }

// Mirrors validatePassword's rules in display order. too_long is deliberately
// absent: it is a server-side guard, not something to coach the user toward.
const RULES: Rule[] = [
  { reason: "too_short", labelKey: "password_rule_length" },
  { reason: "no_upper", labelKey: "password_rule_upper" },
  { reason: "no_lower", labelKey: "password_rule_lower" },
  { reason: "no_digit", labelKey: "password_rule_digit" },
]

/**
 * Live password feedback for the signup form.
 *
 * Strength is presentation only — acceptance is decided by validatePassword and
 * independently re-checked by the server, so this meter can never widen what the
 * API will accept.
 */
export default function PasswordStrength({ value }: { value: string }) {
  const t = useTranslations("auth")
  const fillRef = useRef<HTMLDivElement | null>(null)
  const score = scorePassword(value)
  const result = validatePassword(value)
  const failed = new Set<PasswordReason>(result.ok ? [] : result.reasons)

  useEffect(() => {
    const fill = fillRef.current
    if (!fill) return

    const width = `${(score / 4) * 100}%`
    const background = BAR_COLORS[score]

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      fill.style.width = width
      fill.style.background = background
      return
    }

    animate(fill, { width, background, duration: 420, ease: "outQuad" })
  }, [score])

  if (!value) return null

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        role="progressbar"
        aria-label={t("password_strength_label")}
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={score}
        aria-valuetext={t(`password_strength_${score}`)}
        style={{ height: 4, borderRadius: 9999, background: "rgba(255,255,255,0.12)", overflow: "hidden" }}
      >
        <div ref={fillRef} style={{ height: "100%", width: 0, background: BAR_COLORS[0], borderRadius: 9999 }} />
      </div>

      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
        {t("password_strength_label")}: {t(`password_strength_${score}`)}
      </span>

      {/* Announced politely so a screen reader hears rules being satisfied while
          typing, rather than only on submit. */}
      <ul
        aria-live="polite"
        style={{ display: "flex", flexDirection: "column", gap: 4, margin: 0, padding: 0, listStyle: "none" }}
      >
        {RULES.map((rule) => {
          const met = !failed.has(rule.reason)
          return (
            <li
              key={rule.reason}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: met ? GREEN : "rgba(255,255,255,0.5)",
              }}
            >
              <span aria-hidden style={{ display: "inline-flex", width: 12, justifyContent: "center" }}>
                {met ? <Check size={12} /> : "·"}
              </span>
              {t(rule.labelKey)}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
