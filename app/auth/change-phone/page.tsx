"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { createClient } from "@/lib/supabase/client"
import { normalizeHkPhone } from "@/lib/auth/profile"
import { Logo } from "@/components/brand"
import {
  CHANGE_REQUEST_COOLDOWN,
  OTP_RESEND_COOLDOWN,
  OTP_MAX_ATTEMPTS,
} from "@/lib/auth/change-constants"

const DEEP = "#0a0a0a"
const INK = "#f5f5f7"
const SUBTLE = "#A1A1A6"
const BORDER = "rgba(255,255,255,0.1)"
const GREEN = "#22C55E"
const DANGER = "#FF453A"

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif"

type ValidationState = "validating" | "valid" | "invalid" | "expired" | "used"
type Step = "phone" | "otp"

export default function ChangePhonePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations("auth")
  const token = searchParams.get("token")

  const [validationState, setValidationState] = useState<ValidationState>("validating")
  const [requestId, setRequestId] = useState<string | null>(null)
  const [currentPhone, setCurrentPhone] = useState<string | null>(null)
  const [step, setStep] = useState<Step>("phone")

  // Step 1: Phone input
  const [newPhone, setNewPhone] = useState("")
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [sendingOtp, setSendingOtp] = useState(false)

  // Step 2: OTP verification
  const [otp, setOtp] = useState("")
  const [otpError, setOtpError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [otpAttempts, setOtpAttempts] = useState(0)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [success, setSuccess] = useState(false)

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setValidationState("invalid")
      return
    }

    const validateToken = async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push(`/login?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`)
          return
        }

        // Get current phone from profile
        const { data: profile } = await supabase
          .from("users")
          .select("phone")
          .eq("id", user.id)
          .maybeSingle<{ phone: string }>()

        setCurrentPhone(profile?.phone || user.phone || null)

        const res = await fetch("/api/auth/validate-change-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, purpose: "phone" }),
        })

        const data = await res.json()

        if (res.ok && data.ok) {
          setRequestId(data.requestId)
          setValidationState("valid")
        } else if (data.error === "token_expired") {
          setValidationState("expired")
        } else if (data.error === "token_used") {
          setValidationState("used")
        } else {
          setValidationState("invalid")
        }
      } catch (err) {
        console.error("[change-phone] validation error:", err)
        setValidationState("invalid")
      }
    }

    validateToken()
  }, [token, router])

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const handleSendOtp = async () => {
    setPhoneError(null)

    const normalized = normalizeHkPhone(newPhone)
    if (!normalized) {
      setPhoneError(t("change_phone_error_invalid_phone"))
      return
    }

    if (normalized === currentPhone) {
      setPhoneError(t("change_phone_error_same_number"))
      return
    }

    setSendingOtp(true)

    try {
      const supabase = createClient()

      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: normalized,
      })

      if (otpError) {
        console.error("[change-phone] OTP send failed:", otpError)
        if (otpError.message?.includes("already registered")) {
          setPhoneError(t("change_phone_error_phone_exists"))
        } else {
          setPhoneError(t("change_phone_error_generic"))
        }
        setSendingOtp(false)
        return
      }

      setStep("otp")
      setResendCooldown(OTP_RESEND_COOLDOWN)
      setSendingOtp(false)
    } catch (err) {
      console.error("[change-phone] send OTP error:", err)
      setPhoneError(t("change_phone_error_generic"))
      setSendingOtp(false)
    }
  }

  const handleResendOtp = async () => {
    setOtpError(null)
    setSendingOtp(true)

    try {
      const supabase = createClient()
      const normalized = normalizeHkPhone(newPhone)!

      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: normalized,
      })

      if (otpError) {
        console.error("[change-phone] OTP resend failed:", otpError)
        setOtpError(t("change_phone_error_generic"))
        setSendingOtp(false)
        return
      }

      setResendCooldown(OTP_RESEND_COOLDOWN)
      setSendingOtp(false)
    } catch (err) {
      console.error("[change-phone] resend OTP error:", err)
      setOtpError(t("change_phone_error_generic"))
      setSendingOtp(false)
    }
  }

  const handleVerifyOtp = async () => {
    setOtpError(null)

    if (otp.length !== 6) {
      setOtpError(t("change_phone_otp_length_error"))
      return
    }

    if (otpAttempts >= OTP_MAX_ATTEMPTS) {
      setOtpError(t("change_phone_error_otp_locked"))
      return
    }

    setVerifying(true)

    try {
      const normalized = normalizeHkPhone(newPhone)!

      const res = await fetch("/api/auth/complete-phone-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPhone: normalized, otp }),
      })

      const data = await res.json()

      if (res.ok && data.ok) {
        setSuccess(true)
        setTimeout(() => {
          router.push("/member?tab=settings")
        }, 2000)
      } else {
        setOtpAttempts((prev) => prev + 1)

        if (data.error === "otp_invalid") {
          setOtpError(t("change_phone_error_otp_wrong", { remaining: OTP_MAX_ATTEMPTS - (otpAttempts + 1) }))
        } else if (data.error === "otp_expired") {
          setOtpError(t("change_phone_error_otp_expired"))
        } else if (data.error === "phone_in_use") {
          setOtpError(t("change_phone_error_phone_exists"))
        } else if (data.error === "token_expired" || data.error === "token_used") {
          setValidationState(data.error === "token_expired" ? "expired" : "used")
        } else {
          setOtpError(t("change_phone_error_failed"))
        }
        setVerifying(false)
      }
    } catch (err) {
      console.error("[change-phone] verify OTP error:", err)
      setOtpError(t("change_phone_error_generic"))
      setVerifying(false)
    }
  }

  const requestNewLink = () => {
    router.push("/member?tab=settings")
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    minHeight: 48,
    padding: "0 16px",
    borderRadius: "12px",
    border: `1px solid ${BORDER}`,
    background: "rgba(255,255,255,0.05)",
    color: INK,
    fontSize: "15px",
    fontFamily: FONT_FAMILY,
  }

  return (
    <div
      style={{
        fontFamily: FONT_FAMILY,
        background: "#000",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: `1px solid ${BORDER}`,
          borderRadius: "24px",
          padding: "40px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <Logo variant="full" theme="dark" size={40} />
          </div>
          <h1
            style={{
              fontFamily: '"Bebas Neue", sans-serif',
              fontSize: 32,
              letterSpacing: "0.02em",
              color: INK,
              margin: "0 0 8px",
            }}
          >
            {t("change_phone_title")}
          </h1>
          <p style={{ fontSize: 14, color: SUBTLE, margin: 0 }}>
            {t("change_phone_subtitle")}
          </p>
        </div>

        {validationState === "validating" && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div
              style={{
                width: 40,
                height: 40,
                border: "3px solid rgba(255,255,255,0.1)",
                borderTopColor: GREEN,
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                margin: "0 auto 16px",
              }}
            />
            <p style={{ fontSize: 14, color: SUBTLE }}>{t("change_phone_validating")}</p>
          </div>
        )}

        {(validationState === "invalid" || validationState === "expired" || validationState === "used") && (
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                background: "rgba(248,113,113,0.1)",
                border: "2px solid rgba(248,113,113,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
                fontSize: 28,
              }}
            >
              ✕
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: INK, margin: "0 0 8px" }}>
              {validationState === "expired" && t("change_phone_link_expired_title")}
              {validationState === "used" && t("change_phone_link_used_title")}
              {validationState === "invalid" && t("change_phone_link_invalid_title")}
            </h2>
            <p style={{ fontSize: 14, color: SUBTLE, margin: "0 0 24px", lineHeight: 1.5 }}>
              {validationState === "expired" && t("change_phone_link_expired_body")}
              {validationState === "used" && t("change_phone_link_used_body")}
              {validationState === "invalid" && t("change_phone_link_invalid_body")}
            </p>
            <button
              type="button"
              onClick={requestNewLink}
              style={{
                minHeight: 48,
                padding: "0 24px",
                borderRadius: "12px",
                border: `1px solid ${BORDER}`,
                background: "rgba(255,255,255,0.05)",
                color: INK,
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: FONT_FAMILY,
              }}
            >
              {t("change_phone_go_to_settings")}
            </button>
          </div>
        )}

        {validationState === "valid" && !success && step === "phone" && (
          <div>
            {currentPhone && (
              <div
                style={{
                  marginBottom: 24,
                  padding: "12px 16px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${BORDER}`,
                  fontSize: 13,
                  color: SUBTLE,
                }}
              >
                {t("change_phone_current_label")}: <strong style={{ color: INK }}>{currentPhone}</strong>
              </div>
            )}

            <label style={{ display: "block", marginBottom: 20 }}>
              <span style={{ display: "block", fontSize: 13, color: SUBTLE, marginBottom: 8 }}>
                {t("change_phone_new_label")}
              </span>
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder={t("change_phone_new_placeholder")}
                required
                style={inputStyle}
                disabled={sendingOtp}
                autoFocus
              />
            </label>

            {phoneError && (
              <div
                role="alert"
                style={{
                  marginBottom: 20,
                  padding: "12px 16px",
                  borderRadius: "12px",
                  background: "rgba(248,113,113,0.1)",
                  border: "1px solid rgba(248,113,113,0.3)",
                  color: DANGER,
                  fontSize: 13,
                }}
              >
                {phoneError}
              </div>
            )}

            <button
              type="button"
              onClick={handleSendOtp}
              disabled={sendingOtp || !newPhone}
              style={{
                width: "100%",
                minHeight: 52,
                borderRadius: "14px",
                border: "none",
                background: newPhone && !sendingOtp ? GREEN : "rgba(255,255,255,0.1)",
                color: newPhone && !sendingOtp ? DEEP : SUBTLE,
                fontSize: 16,
                fontWeight: 700,
                cursor: sendingOtp || !newPhone ? "not-allowed" : "pointer",
                opacity: sendingOtp ? 0.6 : 1,
                fontFamily: FONT_FAMILY,
              }}
            >
              {sendingOtp ? t("change_phone_sending_otp") : t("change_phone_send_otp")}
            </button>

            <p
              style={{
                marginTop: 20,
                fontSize: 12,
                color: SUBTLE,
                textAlign: "center",
                lineHeight: 1.5,
              }}
            >
              {t("change_phone_otp_note")}
            </p>
          </div>
        )}

        {validationState === "valid" && !success && step === "otp" && (
          <div>
            <div
              style={{
                marginBottom: 24,
                padding: "12px 16px",
                borderRadius: "12px",
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.2)",
                fontSize: 13,
                color: SUBTLE,
                textAlign: "center",
              }}
            >
              {t("change_phone_otp_subtitle")}
              <br />
              <strong style={{ color: INK, fontSize: 15 }}>{normalizeHkPhone(newPhone)}</strong>
            </div>

            <label style={{ display: "block", marginBottom: 20 }}>
              <span style={{ display: "block", fontSize: 13, color: SUBTLE, marginBottom: 8 }}>
                {t("change_phone_otp_label")}
              </span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder={t("change_phone_otp_placeholder")}
                required
                style={{
                  ...inputStyle,
                  textAlign: "center",
                  fontSize: 24,
                  letterSpacing: "0.5em",
                  fontWeight: 600,
                }}
                disabled={verifying || otpAttempts >= OTP_MAX_ATTEMPTS}
                autoFocus
              />
            </label>

            {otpError && (
              <div
                role="alert"
                style={{
                  marginBottom: 20,
                  padding: "12px 16px",
                  borderRadius: "12px",
                  background: "rgba(248,113,113,0.1)",
                  border: "1px solid rgba(248,113,113,0.3)",
                  color: DANGER,
                  fontSize: 13,
                }}
              >
                {otpError}
              </div>
            )}

            {otpAttempts >= OTP_MAX_ATTEMPTS && (
              <div
                role="alert"
                style={{
                  marginBottom: 20,
                  padding: "12px 16px",
                  borderRadius: "12px",
                  background: "rgba(248,113,113,0.1)",
                  border: "1px solid rgba(248,113,113,0.3)",
                  color: DANGER,
                  fontSize: 13,
                }}
              >
                {t("change_phone_error_otp_locked")}
              </div>
            )}

            <button
              type="button"
              onClick={handleVerifyOtp}
              disabled={verifying || otp.length !== 6 || otpAttempts >= OTP_MAX_ATTEMPTS}
              style={{
                width: "100%",
                minHeight: 52,
                marginBottom: 12,
                borderRadius: "14px",
                border: "none",
                background:
                  otp.length === 6 && !verifying && otpAttempts < OTP_MAX_ATTEMPTS
                    ? GREEN
                    : "rgba(255,255,255,0.1)",
                color:
                  otp.length === 6 && !verifying && otpAttempts < OTP_MAX_ATTEMPTS ? DEEP : SUBTLE,
                fontSize: 16,
                fontWeight: 700,
                cursor:
                  verifying || otp.length !== 6 || otpAttempts >= OTP_MAX_ATTEMPTS
                    ? "not-allowed"
                    : "pointer",
                opacity: verifying ? 0.6 : 1,
                fontFamily: FONT_FAMILY,
              }}
            >
              {verifying ? t("change_phone_verifying") : t("change_phone_verify")}
            </button>

            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resendCooldown > 0 || sendingOtp}
              style={{
                width: "100%",
                minHeight: 48,
                borderRadius: "12px",
                border: `1px solid ${BORDER}`,
                background: "rgba(255,255,255,0.05)",
                color: resendCooldown > 0 || sendingOtp ? SUBTLE : INK,
                fontSize: 14,
                fontWeight: 600,
                cursor: resendCooldown > 0 || sendingOtp ? "not-allowed" : "pointer",
                fontFamily: FONT_FAMILY,
              }}
            >
              {resendCooldown > 0
                ? t("change_phone_resend_in", { seconds: resendCooldown })
                : t("change_phone_resend_otp")}
            </button>

            <p
              style={{
                marginTop: 20,
                fontSize: 12,
                color: SUBTLE,
                textAlign: "center",
                lineHeight: 1.5,
              }}
            >
              {t("change_phone_otp_expiry")}
            </p>
          </div>
        )}

        {success && (
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                background: "rgba(34,197,94,0.1)",
                border: "2px solid rgba(34,197,94,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
                fontSize: 28,
              }}
            >
              ✓
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: GREEN, margin: "0 0 8px" }}>
              {t("change_phone_success_title")}
            </h2>
            <p style={{ fontSize: 14, color: SUBTLE, margin: 0 }}>
              {t("change_phone_success_body")}
            </p>
          </div>
        )}

        <style jsx>{`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    </div>
  )
}
