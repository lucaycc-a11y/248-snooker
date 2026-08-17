"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

const GREEN = "#22b86b"
const GREEN_DIM = "rgba(34,184,107,0.12)"
const EASE = [0.2, 0.7, 0.3, 1] as const
const EASE_BOUNCE = [0.34, 1.56, 0.64, 1] as const
const LOCKOUT_DURATION_MIN = 15

// Redirect-scheme allowlist — prevents open-redirect attacks. Only known
// client schemes are accepted. Add new schemes here.
const ALLOWED_REDIRECT_SCHEMES = ["space8admin://auth"]

export default function AdminLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectParam = searchParams.get("redirect") ?? ""

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState("")
  const [successCode, setSuccessCode] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Lockout countdown ticker
  useEffect(() => {
    if (!lockedUntil) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
    const tick = () => {
      const remaining = Math.max(0, Math.round((lockedUntil.getTime() - Date.now()) / 1000))
      if (remaining <= 0) {
        setLockedUntil(null)
        setCountdown("")
        if (timerRef.current) clearInterval(timerRef.current)
        return
      }
      const m = Math.floor(remaining / 60)
      const s = remaining % 60
      setCountdown(`${m}:${s.toString().padStart(2, "0")}`)
    }
    tick()
    timerRef.current = setInterval(tick, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [lockedUntil])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (lockedUntil && lockedUntil.getTime() > Date.now()) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, redirect: redirectParam }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        // Lockout response
        if (data.lockedUntil) {
          setLockedUntil(new Date(data.lockedUntil))
          setError(`登入嘗試次數過多，請於 ${LOCKOUT_DURATION_MIN} 分鐘後再試`)
        } else {
          setError(data.error ?? "電郵或密碼不正確")
        }
        setBusy(false)
        return
      }
      // Success: we have a redirect URL with the exchange code
      if (data.redirectUrl) {
        // If this is an iOS redirect (custom scheme), show the code and
        // redirect to the callback URL so the app can catch it
        window.location.href = data.redirectUrl
      } else {
        // Fallback: redirect to admin dashboard
        router.replace("/admin")
      }
    } catch {
      setError("網絡錯誤，請稍後再試")
      setBusy(false)
    }
  }, [email, password, redirectParam, lockedUntil, router])

  // ── Success screen (code displayed, redirecting) ────────────────
  if (successCode) {
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>登入成功</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>正在跳轉...</div>
      </div>
    )
  }

  // ── Lockout screen ────────────────────────────────────────────────
  if (lockedUntil && lockedUntil.getTime() > Date.now()) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
        style={{ textAlign: "center" }}
      >
        <div
          style={{
            width: 48, height: 48, borderRadius: 24,
            background: "rgba(255,69,58,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF453A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 8 }}>
          帳號暫時鎖定
        </h2>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 4, lineHeight: 1.5 }}>
          登入嘗試次數過多，帳號已暫時鎖定
        </p>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 24, lineHeight: 1.5 }}>
          請於 {countdown} 後再試
        </p>
        <div style={{ fontSize: 32, fontWeight: 700, color: GREEN, fontVariantNumeric: "tabular-nums" }}>
          {countdown}
        </div>
      </motion.div>
    )
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_BOUNCE }}
    >
      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <img
          src="/logos/logo-white-mark.svg"
          alt="Space8"
          style={{ height: 44, width: "auto", marginBottom: 16 }}
        />
        <h1 style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 34, letterSpacing: "0.02em", color: "#fff", margin: 0 }}>
          ADMIN LOGIN
        </h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 6 }}>
          使用 Space8 管理員帳號登入
        </p>
      </div>

      {/* Error */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            role="alert"
            style={{
              marginBottom: 16,
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Email */}
      <div style={{ marginBottom: 14 }}>
        <label
          htmlFor="admin-email"
          style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 6, letterSpacing: "0.04em" }}
        >
          電郵
        </label>
        <input
          id="admin-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@space8.com.hk"
          autoComplete="email"
          autoFocus
          style={{
            width: "100%", height: 48,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 12,
            padding: "0 16px",
            color: "#fff",
            fontSize: 15,
            outline: "none",
            transition: "border-color 0.2s ease",
          }}
          onFocus={(e) => { e.target.style.borderColor = GREEN }}
          onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.12)" }}
        />
      </div>

      {/* Password */}
      <div style={{ marginBottom: 24 }}>
        <label
          htmlFor="admin-password"
          style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 6, letterSpacing: "0.04em" }}
        >
          密碼
        </label>
        <div style={{ position: "relative" }}>
          <input
            id="admin-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            style={{
              width: "100%", height: 48,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              padding: "0 44px 0 16px",
              color: "#fff",
              fontSize: 15,
              outline: "none",
              transition: "border-color 0.2s ease",
            }}
            onFocus={(e) => { e.target.style.borderColor = GREEN }}
            onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.12)" }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}
            style={{
              position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", color: "rgba(255,255,255,0.35)",
              cursor: "pointer", fontSize: 12, padding: 4,
            }}
          >
            {showPassword ? "隱藏" : "顯示"}
          </button>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={busy || !email.trim() || !password}
        className="pbtn-primary"
        style={{
          width: "100%", height: 48,
          border: "none", borderRadius: 14,
          background: busy || !email.trim() || !password ? "rgba(34,184,107,0.35)" : GREEN,
          color: "#000", fontWeight: 700, fontSize: 15,
          cursor: busy || !email.trim() || !password ? "not-allowed" : "pointer",
          transition: "background 0.25s ease, transform 0.35s cubic-bezier(0.2,0.7,0.3,1)",
        }}
      >
        {busy ? (
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Loader2 size={16} style={{ animation: "space8-spin 1.4s linear infinite" }} />
            登入中...
          </span>
        ) : (
          "登入"
        )}
      </button>
    </motion.form>
  )
}