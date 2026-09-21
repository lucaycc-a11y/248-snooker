"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { createClient } from "@/lib/supabase/client"
import { validatePassword } from "@/lib/auth/password"
import PasswordStrength from "@/components/auth/PasswordStrength"
import { Logo } from "@/components/brand"

const DEEP = "#0a0a0a"
const INK = "#f5f5f7"
const SUBTLE = "#A1A1A6"
const BORDER = "rgba(255,255,255,0.1)"
const GREEN = "#22C55E"
const DANGER = "#FF453A"

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif"

type ValidationState = "validating" | "valid" | "invalid" | "expired" | "used"

export default function ChangePasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations("auth")
  const token = searchParams.get("token")

  const [validationState, setValidationState] = useState<ValidationState>("validating")
  const [requestId, setRequestId] = useState<string | null>(null)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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

        const res = await fetch("/api/auth/validate-change-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, purpose: "password" }),
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
        console.error("[change-password] validation error:", err)
        setValidationState("invalid")
      }
    }

    validateToken()
  }, [token, router])

  const passwordCheck = validatePassword(password)
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!passwordCheck.ok) {
      setError(t("change_password_error_requirements"))
      return
    }

    if (!passwordsMatch) {
      setError(t("change_password_error_mismatch"))
      return
    }

    if (!token) {
      setError(t("change_password_error_invalid_link"))
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch("/api/auth/complete-password-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json()

      if (res.ok && data.ok) {
        setSuccess(true)
        setTimeout(() => {
          router.push("/member?tab=settings")
        }, 2000)
      } else {
        if (data.error === "token_expired") {
          setValidationState("expired")
        } else if (data.error === "token_used") {
          setValidationState("used")
        } else if (data.error === "password_same") {
          setError(t("change_password_error_same"))
        } else {
          setError(t("change_password_error_failed"))
        }
        setSubmitting(false)
      }
    } catch (err) {
      console.error("[change-password] submit error:", err)
      setError(t("change_password_error_generic"))
      setSubmitting(false)
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
            {t("change_password_title")}
          </h1>
          <p style={{ fontSize: 14, color: SUBTLE, margin: 0 }}>
            {t("change_password_subtitle")}
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
            <p style={{ fontSize: 14, color: SUBTLE }}>{t("change_password_validating")}</p>
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
              {validationState === "expired" && t("change_password_link_expired_title")}
              {validationState === "used" && t("change_password_link_used_title")}
              {validationState === "invalid" && t("change_password_link_invalid_title")}
            </h2>
            <p style={{ fontSize: 14, color: SUBTLE, margin: "0 0 24px", lineHeight: 1.5 }}>
              {validationState === "expired" && t("change_password_link_expired_desc")}
              {validationState === "used" && t("change_password_link_used_desc")}
              {validationState === "invalid" && t("change_password_link_invalid_desc")}
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
              {t("change_password_go_to_settings")}
            </button>
          </div>
        )}

        {validationState === "valid" && !success && (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: 13, color: SUBTLE, marginBottom: 8 }}>
                {t("change_password_new_label")}
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("change_password_new_placeholder")}
                required
                style={inputStyle}
                disabled={submitting}
                autoFocus
              />
            </label>

            {password && <PasswordStrength value={password} />}

            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: 13, color: SUBTLE, marginBottom: 8 }}>
                {t("change_password_confirm_label")}
              </span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("change_password_confirm_placeholder")}
                required
                style={inputStyle}
                disabled={submitting}
              />
            </label>

            {confirmPassword && !passwordsMatch && (
              <p style={{ fontSize: 13, color: DANGER, margin: 0 }}>
                {t("change_password_error_mismatch")}
              </p>
            )}

            {error && (
              <div
                role="alert"
                style={{
                  padding: "12px 16px",
                  borderRadius: "12px",
                  background: "rgba(248,113,113,0.1)",
                  border: "1px solid rgba(248,113,113,0.3)",
                  color: DANGER,
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !passwordCheck.ok || !passwordsMatch}
              style={{
                minHeight: 52,
                borderRadius: "14px",
                border: "none",
                background: passwordCheck.ok && passwordsMatch ? GREEN : "rgba(255,255,255,0.1)",
                color: passwordCheck.ok && passwordsMatch ? DEEP : SUBTLE,
                fontSize: 16,
                fontWeight: 700,
                cursor: submitting || !passwordCheck.ok || !passwordsMatch ? "not-allowed" : "pointer",
                opacity: submitting ? 0.6 : 1,
                fontFamily: FONT_FAMILY,
              }}
            >
              {submitting ? t("change_password_submitting") : t("change_password_submit")}
            </button>
          </form>
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
              {t("change_password_success_title")}
            </h2>
            <p style={{ fontSize: 14, color: SUBTLE, margin: 0 }}>
              {t("change_password_success_desc")}
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
