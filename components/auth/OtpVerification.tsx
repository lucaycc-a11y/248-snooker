"use client"

import { useEffect, useRef, useState } from "react"
import confetti from "canvas-confetti"
import { useTranslations } from "next-intl"
import { OtpInput } from "./OtpInput"

export type OtpVerificationStatus = "input" | "verifying" | "success" | "failure" | "expired" | "locked"

export function OtpVerification({
  length,
  value,
  onChange,
  onComplete,
  status,
  error,
  onReset,
  disabled = false,
  expiresAt,
}: {
  length: number
  value: string[]
  onChange: (next: string[]) => void
  onComplete: (code: string) => void
  status: OtpVerificationStatus
  error?: string | null
  onReset: () => void
  disabled?: boolean
  expiresAt?: string | null
}) {
  const t = useTranslations("auth")
  const statusRef = useRef<HTMLDivElement>(null)
  const instructionId = "auth-otp-instruction"
  const errorId = "auth-otp-error"
  const digits = Array.from({ length }, (_, index) => value[index] ?? "")
  const codeComplete = digits.every((digit) => digit.length === 1)
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)

  useEffect(() => {
    if (!expiresAt) {
      setRemainingSeconds(null)
      return
    }
    const update = () => setRemainingSeconds(Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000)))
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [expiresAt])

  useEffect(() => {
    if (status !== "success") return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const timer = window.setTimeout(() => {
      confetti({ particleCount: 72, spread: 68, startVelocity: 28, scalar: 0.8, origin: { y: 0.52 }, colors: ["#22b86b", "#1a9d5c", "#0f7845", "#4ade80", "#ffffff"] })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [status])

  useEffect(() => {
    if (status === "verifying" || status === "success") statusRef.current?.focus()
  }, [status])

  const effectiveStatus = status === "input" && remainingSeconds === 0 ? "expired" : status

  if (effectiveStatus === "input" || effectiveStatus === "failure" || effectiveStatus === "expired" || effectiveStatus === "locked") {
    const hasError = effectiveStatus !== "input"
    const unavailable = effectiveStatus === "expired" || effectiveStatus === "locked"
    const describedBy = hasError ? `${instructionId} ${errorId}` : instructionId
    const displayError = effectiveStatus === "expired" ? t("err_otp_expired") : effectiveStatus === "locked" ? t("err_otp_locked") : error
    const formattedRemaining = remainingSeconds === null ? "" : `${Math.floor(remainingSeconds / 60).toString().padStart(2, "0")}:${(remainingSeconds % 60).toString().padStart(2, "0")}`
    return (
      <div className={`otp-verification otp-verification-${status}`}>
        <fieldset className="otp-input-fieldset">
          <legend className="sr-only">{t("otp_instruction", { length })}</legend>
          <p id={instructionId} className="sr-only" data-cms-key="auth.otp.instruction">{t("otp_instruction", { length })}</p>
          <OtpInput length={length} value={value} onChange={onChange} onComplete={onComplete} disabled={disabled || unavailable || remainingSeconds === 0} invalid={hasError} className={hasError ? "otp-input-grid-failure" : undefined} digitLabel={(index) => t("otp_digit", { number: index + 1 })} ariaDescribedBy={describedBy} focusFirst={status === "input"} />
        </fieldset>
        {expiresAt && remainingSeconds !== null && !unavailable && remainingSeconds > 0 && <p className="otp-verification-expiry" role="status" aria-live="polite">{t("resend_in", { seconds: formattedRemaining })}</p>}
        {hasError && <>
          <p id={errorId} className="otp-verification-error" role="alert" data-cms-key="auth.otp.error">{displayError ?? t("err_otp_wrong_generic")}</p>
          {!unavailable && <button type="button" className="otp-reset-button" onClick={onReset} disabled={disabled} data-cms-key="auth.otp.try_again">{t("otp_try_again")}</button>}
        </>}
      </div>
    )
  }

  return (
    <div ref={statusRef} className={`otp-verification otp-verification-${status}`} role="status" aria-live="polite" aria-atomic="true" aria-label={status === "success" ? t("otp_verified") : t("otp_verifying")} tabIndex={-1}>
      <div className="otp-spinner-container" aria-hidden="true"><div className="otp-spinner" />{status === "success" && <div className="otp-success-badge"><svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19.5 6.7" /></svg></div>}</div>
      <p className="otp-verification-status" data-cms-key={status === "success" ? "auth.otp.verified" : "auth.otp.verifying"}>{status === "success" ? t("otp_verified") : t("otp_verifying")}</p>
      {!codeComplete && <span className="sr-only">{t("otp_instruction", { length })}</span>}
    </div>
  )
}
