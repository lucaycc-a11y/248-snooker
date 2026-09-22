"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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

export default function SetPasswordForm({ userEmail }: { userEmail: string | null }) {
  const router = useRouter()
  const t = useTranslations("auth")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passwordCheck = validatePassword(password)
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!passwordCheck.ok) {
      setError(t("set_password_error_requirements"))
      return
    }

    if (!passwordsMatch) {
      setError(t("set_password_error_mismatch"))
      return
    }

    setSubmitting(true)

    try {
      const supabase = createClient()

      // Update password via Supabase auth
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        console.error("[set-password] updateUser failed:", updateError)
        setError(t("set_password_error_failed"))
        setSubmitting(false)
        return
      }

      // Mark password as set in user_password_status
      const res = await fetch("/api/auth/password-set", {
        method: "POST",
      })

      if (!res.ok) {
        console.error("[set-password] password-set API failed")
        // Password was set in auth, so still proceed
      }

      // Success → redirect to member area
      router.push("/member")
      router.refresh()
    } catch (err) {
      console.error("[set-password] error:", err)
      setError(t("set_password_error_generic"))
      setSubmitting(false)
    }
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
            {t("set_password_title")}
          </h1>
          <p style={{ fontSize: 14, color: SUBTLE, margin: 0 }}>
            {t("set_password_subtitle")}
          </p>
        </div>

        {userEmail && (
          <div
            style={{
              marginBottom: 24,
              padding: "12px 16px",
              borderRadius: "12px",
              background: "rgba(34,197,94,0.1)",
              border: "1px solid rgba(34,197,94,0.2)",
              fontSize: 13,
              color: SUBTLE,
            }}
          >
            <strong style={{ color: INK }}>{userEmail}</strong>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <label style={{ display: "block" }}>
            <span style={{ display: "block", fontSize: 13, color: SUBTLE, marginBottom: 8 }}>
              {t("set_password_label")}
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("set_password_placeholder")}
              required
              style={inputStyle}
              disabled={submitting}
            />
          </label>

          {password && <PasswordStrength value={password} />}

          <label style={{ display: "block" }}>
            <span style={{ display: "block", fontSize: 13, color: SUBTLE, marginBottom: 8 }}>
              {t("set_password_confirm_label")}
            </span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("set_password_confirm_placeholder")}
              required
              style={inputStyle}
              disabled={submitting}
            />
          </label>

          {confirmPassword && !passwordsMatch && (
            <p style={{ fontSize: 13, color: DANGER, margin: 0 }}>
              {t("set_password_error_mismatch")}
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
            {submitting ? t("set_password_submitting") : t("set_password_submit")}
          </button>
        </form>

        <p
          style={{
            marginTop: 24,
            fontSize: 12,
            color: SUBTLE,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          {t("set_password_requirements")}
        </p>
      </div>
    </div>
  )
}
