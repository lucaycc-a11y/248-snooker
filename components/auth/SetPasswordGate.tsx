"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { validatePassword } from "@/lib/auth/password"
import { PasswordInput } from "@/components/shared/PasswordInput"
import PasswordStrength from "./PasswordStrength"
import { LoadingGif } from "@/components/shared/LoadingGif"

const GREEN = "#22c55e"
const EASE = [0.16, 1, 0.3, 1] as const

// Full-screen mandatory password setup gate. Shown after any successful sign-in
// or sign-up via email or phone (OTP/magic link/any non-password method) if the
// user has no password. The user cannot reach any member page, booking flow or
// checkout until it is completed. Enforced server-side via middleware + the
// user_password_status table.
export function SetPasswordGate({ onComplete }: { onComplete: () => void }) {
  const t = useTranslations("auth")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const passwordCheck = validatePassword(password)
  const passwordsMatch = password === confirmPassword
  const canSubmit = passwordCheck.ok && passwordsMatch && password.length > 0

  const handleSubmit = async () => {
    if (!canSubmit) return

    setBusy(true)
    setError(null)

    try {
      const supabase = createClient()

      // Update password via Supabase auth
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) {
        // Handle specific errors
        if (updateError.message?.includes("same")) {
          setError(t("err_password_same_as_old"))
        } else if (updateError.message?.includes("weak")) {
          setError(t("err_password_too_weak"))
        } else if (updateError.message?.includes("session")) {
          setError(t("err_session_expired"))
        } else {
          setError(t("err_generic"))
        }
        setBusy(false)
        return
      }

      // Mark password as set via server endpoint
      const response = await fetch("/api/auth/password-set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        setError(t("err_generic"))
        setBusy(false)
        return
      }

      // Success - proceed to app
      onComplete()
    } catch (err) {
      console.error("[SetPasswordGate] error:", err)
      setError(t("err_generic"))
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000",
        padding: 20,
        zIndex: 9999,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="glass-panel"
        style={{
          width: "100%",
          maxWidth: 400,
          padding: 40,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1
            data-cms-key="auth.set_password_title"
            style={{
              fontFamily: '"Bebas Neue", sans-serif',
              fontSize: 32,
              letterSpacing: "0.02em",
              color: "#fff",
              margin: "0 0 8px 0",
            }}
          >
            {t("set_password_title")}
          </h1>
          <p
            data-cms-key="auth.set_password_subtitle"
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.7)",
              margin: 0,
            }}
          >
            {t("set_password_subtitle")}
          </p>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              marginBottom: 20,
              padding: "10px 14px",
              borderRadius: 12,
              background: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.3)",
              color: "#f87171",
              fontSize: 13,
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label
            data-cms-key="auth.password_label"
            htmlFor="new-password"
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 500,
              color: "rgba(255,255,255,0.9)",
              marginBottom: 8,
            }}
          >
            {t("password_label")}
          </label>
          <PasswordInput
            id="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit) handleSubmit()
            }}
            disabled={busy}
            autoComplete="new-password"
            autoFocus
          />
          {password.length > 0 && <PasswordStrength value={password} />}
        </div>

        <div style={{ marginBottom: 24 }}>
          <label
            data-cms-key="auth.confirm_password_label"
            htmlFor="confirm-password"
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 500,
              color: "rgba(255,255,255,0.9)",
              marginBottom: 8,
            }}
          >
            {t("confirm_password_label")}
          </label>
          <PasswordInput
            id="confirm-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit) handleSubmit()
            }}
            disabled={busy}
            autoComplete="new-password"
          />
          {confirmPassword.length > 0 && !passwordsMatch && (
            <div
              data-cms-key="auth.err_passwords_mismatch"
              style={{
                marginTop: 8,
                fontSize: 12,
                color: "#f87171",
              }}
            >
              {t("err_passwords_mismatch")}
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || busy}
          style={{
            width: "100%",
            height: 44,
            border: "none",
            borderRadius: 12,
            background: canSubmit && !busy ? GREEN : "rgba(255,255,255,0.1)",
            color: canSubmit && !busy ? "#000" : "rgba(255,255,255,0.3)",
            fontSize: 15,
            fontWeight: 600,
            cursor: canSubmit && !busy ? "pointer" : "not-allowed",
            transition: "all 0.2s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {busy ? <LoadingGif size={20} /> : null}
          <span data-cms-key="auth.set_password_button">
            {t("set_password_button")}
          </span>
        </button>
      </motion.div>
    </div>
  )
}
