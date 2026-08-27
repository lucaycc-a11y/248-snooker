"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft } from "lucide-react"
import { useTranslations } from "next-intl"
import { createClient } from "@/lib/supabase/client"
import { normalizeHkPhone } from "@/lib/auth/profile"
import { LoadingGif } from "@/components/ui/LoadingGif"
import { GoogleSignInButton } from "./GoogleSignInButton"
import { AppleSignInButton } from "./AppleSignInButton"
import { OtpVerification, type OtpVerificationStatus } from "./OtpVerification"
import { ProfileCompletion } from "./ProfileCompletion"
import { QRGuideModal } from "./QRGuideModal"

// Landing-page language: the site green is the single primary accent/CTA; black
// text on the green button; surfaces are translucent-white glass (provided by the
// parent modal/login card).
const GREEN = "#22c55e"
const OTP_LENGTH = 6
const RESEND_COOLDOWN = 60
const MAX_OTP_ATTEMPTS = 3
const EASE = [0.16, 1, 0.3, 1] as const

type Phase = "methods" | "contact" | "otp" | "profile" | "password"
type OtpChannel = "sms" | "email"
type OtpDeliveryChannel = "whatsapp" | "sms"
type ContactTab = "phone" | "email"
type Prefill = { name: string; email: string; phone: string; phoneVerified: boolean }
type Grecaptcha = {
  execute: (siteKey: string, options: { action: string }) => Promise<string>
}

function isGrecaptcha(value: unknown): value is Grecaptcha {
  if (!value || typeof value !== "object") return false
  const candidate = value as { execute?: unknown }
  return typeof candidate.execute === "function"
}

// Reusable auth content — the single source of truth used by BOTH the /login page
// and the in-booking modal. Method picker shows three clean options: Apple, Google,
// and "continue with phone or email" (which expands to a tabbed phone/email entry).
// After any first sign-in it gates on profile completion — which itself requires a
// verified phone (see ProfileCompletion) — before calling onAuthComplete.
export function AuthCard({
  returnUrl,
  onAuthComplete,
}: {
  returnUrl: string
  onAuthComplete: () => void
}) {
  const t = useTranslations("auth")
  const [phase, setPhase] = useState<Phase>("methods")
  const [contactTab, setContactTab] = useState<ContactTab>("phone")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [otpChannel, setOtpChannel] = useState<OtpChannel>("sms")
  const [messageId, setMessageId] = useState("")
  const [otpDeliveryChannel, setOtpDeliveryChannel] = useState<OtpDeliveryChannel>("sms")
  const [otp, setOtp] = useState<string[]>(() => Array.from({ length: OTP_LENGTH }, () => ""))
  const [otpStatus, setOtpStatus] = useState<OtpVerificationStatus>("input")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_OTP_ATTEMPTS)
  const [cooldown, setCooldown] = useState(0)
  const [prefill, setPrefill] = useState<Prefill>({ name: "", email: "", phone: "", phoneVerified: false })
  // True until the mount-time session check resolves — avoids flashing the method
  // picker to a user who's already signed in (e.g. returning from an OAuth redirect).
  const [initializing, setInitializing] = useState(true)
  const didInit = useRef(false)
  // QR guide modal — shown after first profile completion (new registration).
  const [qrMemberCode, setQrMemberCode] = useState<string | null>(null)

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(id)
  }, [cooldown])

  // On mount: if a session already exists (returning from a Google redirect, or a
  // logged-in user reaching the login step), resolve straight to the profile gate
  // or completion — never show the method picker again. Runs once per completed
  // attempt: if the effect is cancelled mid-flight (React 18 strict-mode's
  // mount→unmount→remount, or any real remount), didInit resets so the re-run
  // actually executes — otherwise the card hangs on the loading state forever
  // with the session check half-done.
  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        setInitializing(false)
        return
      }
      const { data } = await supabase
        .from("users")
        .select("display_name, email, phone, profile_complete")
        .eq("id", user.id)
        .maybeSingle()
      if (cancelled) return
      if (data?.profile_complete === true) {
        onAuthComplete()
        return
      }
      const verifiedPhone = user.phone ?? ""
      setPrefill({
        name:
          data?.display_name ??
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          "",
        email: data?.email ?? user.email ?? "",
        phone: data?.phone ?? verifiedPhone,
        phoneVerified: verifiedPhone.length > 0,
      })
      setPhase("profile")
      setInitializing(false)
    })()
    return () => {
      cancelled = true
      didInit.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // After any successful sign-in, decide: profile complete → done; else → gate.
  // Pre-fills the profile form from the provider identity (Apple/Google name,
  // SMS phone) so users don't retype what we already know.
  const afterSignIn = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError(t("err_generic"))
      setBusy(false)
      setOtpStatus("failure")
      return
    }
    const { data } = await supabase
      .from("users")
      .select("display_name, email, phone, profile_complete")
      .eq("id", user.id)
      .maybeSingle()

    if (data?.profile_complete === true) {
      onAuthComplete()
      return
    }
    const verifiedPhone = user.phone ?? ""
    setPrefill({
      name:
        data?.display_name ??
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        "",
      email: data?.email ?? user.email ?? "",
      phone: data?.phone ?? (verifiedPhone || (phone ? normalizeHkPhone(phone) ?? "" : "")),
      phoneVerified: verifiedPhone.length > 0,
    })
    setBusy(false)
    setPhase("profile")
  }, [onAuthComplete, t, phone])

  const sendOtp = async () => {
    const normalized = normalizeHkPhone(phone)
    if (!normalized) {
      setError(t("err_phone"))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
      if (!siteKey) {
        setError(t("err_send"))
        setBusy(false)
        return
      }

      const grecaptchaValue: unknown = typeof window === "undefined" ? undefined : window.grecaptcha
      if (!isGrecaptcha(grecaptchaValue)) {
        setError(t("err_send"))
        setBusy(false)
        return
      }

      const recaptchaToken = await grecaptchaValue.execute(siteKey, { action: "send_otp" })

      const res = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized, recaptchaToken }),
      })
      const j = await res.json().catch(() => ({}))

      if (!j?.success) {
        if (j?.error === "rate_limited") {
          setError(t("err_rate_limited"))
        } else {
          setError(j?.error || t("err_send"))
        }
        setBusy(false)
        return
      }

      setOtp(Array.from({ length: OTP_LENGTH }, () => ""))
      setOtpStatus("input")
      setOtpChannel("sms")
      setMessageId(typeof j?.messageId === "string" ? j.messageId : "")
      setOtpDeliveryChannel(j?.channel === "whatsapp" ? "whatsapp" : "sms")
      setAttemptsLeft(MAX_OTP_ATTEMPTS)
      setCooldown(RESEND_COOLDOWN)
      setBusy(false)
      setPhase("otp")
    } catch {
      setError(t("err_network"))
      setBusy(false)
    }
  }

  const sendEmailOtp = async () => {
    const trimmed = email.trim()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(t("err_email"))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/send-email-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      })
      const j = await res.json().catch(() => ({}))
      if (j?.ok !== true) {
        if (j?.error === "rate_limited") {
          setError(t("err_rate_limited"))
        } else {
          setError(j?.detail ? `${t("err_send")} (${j.detail})` : t("err_send"))
        }
        setBusy(false)
        return
      }
      setOtp(Array.from({ length: OTP_LENGTH }, () => ""))
      setOtpStatus("input")
      setOtpChannel("email")
      setAttemptsLeft(MAX_OTP_ATTEMPTS)
      setCooldown(RESEND_COOLDOWN)
      setBusy(false)
      setPhase("otp")
    } catch {
      setError(t("err_network"))
      setBusy(false)
    }
  }

  const signInWithPassword = async () => {
    const trimmed = email.trim()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(t("err_email"))
      return
    }
    if (!password) {
      setError(t("err_password"))
      return
    }
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    })
    if (signInErr) {
      setError(t("err_password"))
      setBusy(false)
      return
    }
    await afterSignIn()
  }

  const verifyOtp = async (code: string) => {
    setBusy(true)
    setOtpStatus("verifying")
    setError(null)
    const supabase = createClient()

    // SMS/WhatsApp path: the code was issued by Engagelab (not Supabase), so
    // Supabase's native sms verifyOtp can't validate it. We POST to /api/otp/verify,
    // which checks the code with Engagelab and returns a Supabase magiclink
    // token_hash; exchanging that mints the session with Supabase as the authority.
    let vErr: { message: string } | null = null
    if (otpChannel === "email") {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: "email" })
      vErr = error
    } else {
      const normalized = normalizeHkPhone(phone) ?? ""
      if (!normalized || !messageId) {
        setError(t("err_otp_expired"))
        setOtpStatus("failure")
        setBusy(false)
        return
      }
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized, messageId, code }),
      }).catch(() => null)
      const j = res ? await res.json().catch(() => ({})) : {}
      if (!j?.success || typeof j.tokenHash !== "string") {
        if (j?.error === "rate_limited") {
          setError(t("err_rate_limited"))
          setOtpStatus("failure")
          setBusy(false)
          return
        }
        if (j?.status === "not_found") {
          setError(t("err_otp_not_found"))
          setOtpStatus("failure")
          setBusy(false)
          return
        }
        // Backend rejected the code (wrong / expired). Same localized
        // attempt-countdown UX as the email branch.
        const remaining = attemptsLeft - 1
        setAttemptsLeft(remaining)
        if (remaining > 0) {
          setError(t("err_otp_wrong", { count: remaining }))
        } else {
          setError(t("err_otp_locked"))
          setPhase("methods")
        }
        setOtpStatus("failure")
        setBusy(false)
        return
      }
      const { error } = await supabase.auth.verifyOtp({ token_hash: j.tokenHash, type: "magiclink" })
      vErr = error
    }

    if (vErr) {
      const expired = /expired/i.test(vErr.message)
      const remaining = attemptsLeft - 1
      if (expired) {
        setError(t("err_otp_expired"))
      } else if (remaining > 0) {
        setError(t("err_otp_wrong", { count: remaining }))
      } else {
        setError(t("err_otp_locked"))
        setPhase("methods")
      }
      setOtpStatus(remaining > 0 ? "failure" : "input")
      setBusy(false)
      return
    }
    setOtpStatus("success")
    await new Promise<void>((resolve) => window.setTimeout(resolve, 720))
    await afterSignIn()
  }

  // ── Initializing (mount-time session check in flight) ───────────────────────
  // Avoids flashing the method picker to a user who's already signed in.
  if (initializing && phase === "methods") {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
        <LoadingGif />
      </div>
    )
  }

  // ── Profile gate ───────────────────────────────────────────────────────────
  if (phase === "profile") {
    return (
      <>
      <ProfileCompletion
        initialName={prefill.name}
        initialEmail={prefill.email}
        initialPhone={prefill.phone}
        isPhoneVerified={prefill.phoneVerified}
        onComplete={(memberCode) => {
          if (memberCode) {
            setQrMemberCode(memberCode)
            return
          }
          onAuthComplete()
        }}
        labels={{
          title: t("profile_title"),
          subtitle: t("profile_subtitle"),
          name: t("profile_name"),
          email: t("profile_email"),
          phone: t("profile_phone"),
          submit: t("profile_submit"),
          saving: t("saving"),
          err_name: t("err_name"),
          err_email: t("err_email"),
          err_phone: t("err_phone"),
          err_generic: t("err_generic"),
          phone_verified_badge: t("profile_phone_verified_badge"),
        }}
      />
      {qrMemberCode && (
        <QRGuideModal
          memberCode={qrMemberCode}
          onClose={() => { setQrMemberCode(null); onAuthComplete() }}
        />
      )}
      </>
    )
  }

  // ── OTP entry ────────────────────────────────────────────────────────────────
  if (phase === "otp") {
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease: EASE }}>
        <button
          type="button"
          onClick={() => { setPhase("methods"); setError(null); setOtpStatus("input") }}
          aria-label={t("back")}
          style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", marginBottom: 16, fontSize: 14 }}
        >
          <ChevronLeft size={16} /> {t("back")}
        </button>
        <h2 data-cms-key="auth.otp.title" style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 30, color: "#fff", marginBottom: 6 }}>
          {t("otp_title")}
        </h2>
        <p data-cms-key="auth.otp.subtitle" style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 24 }}>
          {otpChannel === "email"
            ? t("otp_subtitle_email", { email })
            : otpDeliveryChannel === "whatsapp"
              ? t("otp_subtitle_whatsapp", { phone })
              : t("otp_subtitle", { phone })}
        </p>

          <OtpVerification
            length={OTP_LENGTH}
            value={otp}
            onChange={setOtp}
            onComplete={verifyOtp}
            status={otpStatus}
            error={error}
            onReset={() => { setOtp(Array.from({ length: OTP_LENGTH }, () => "")); setError(null); setOtpStatus("input") }}
            disabled={busy}
          />

        <button
          type="button"
          onClick={otpChannel === "email" ? sendEmailOtp : sendOtp}
          disabled={cooldown > 0 || busy}
          data-cms-key="auth.otp.resend"
          style={{ marginTop: 20, width: "100%", background: "none", border: "none", color: cooldown > 0 ? "rgba(255,255,255,0.35)" : GREEN, fontSize: 14, cursor: cooldown > 0 ? "default" : "pointer" }}
        >
          {cooldown > 0 ? t("resend_in", { seconds: cooldown }) : t("resend")}
        </button>
      </motion.div>
    )
  }

  // ── Password entry ───────────────────────────────────────────────────────────
  if (phase === "password") {
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease: EASE }}>
        <button
          type="button"
          onClick={() => { setPhase("methods"); setError(null); setPassword("") }}
          aria-label={t("back")}
          style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", marginBottom: 16, fontSize: 14 }}
        >
          <ChevronLeft size={16} /> {t("back")}
        </button>
        <h2 data-cms-key="auth.password.title" style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 30, color: "#fff", marginBottom: 6 }}>
          {t("sign_in_password")}
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("email_placeholder")}
            inputMode="email"
            autoComplete="email"
            aria-label={t("email_placeholder")}
            style={{ height: 52, background: "rgba(255,255,255,0.04)", border: `1px solid ${error ? "#f87171" : "rgba(255,255,255,0.14)"}`, borderRadius: 12, padding: "0 16px", color: "#fff", fontSize: 16, outline: "none" }}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("password_placeholder")}
            type="password"
            autoComplete="current-password"
            aria-label={t("password_placeholder")}
            style={{ height: 52, background: "rgba(255,255,255,0.04)", border: `1px solid ${error ? "#f87171" : "rgba(255,255,255,0.14)"}`, borderRadius: 12, padding: "0 16px", color: "#fff", fontSize: 16, outline: "none" }}
          />
          <button
            type="button"
            onClick={signInWithPassword}
            disabled={busy}
            data-cms-key="auth.password.submit"
            style={{ width: "100%", height: 52, border: "none", borderRadius: 9999, background: busy ? "rgba(34,197,94,0.5)" : GREEN, color: "#000", fontWeight: 700, fontSize: 16, cursor: busy ? "not-allowed" : "pointer" }}
          >
            {busy ? t("sending") : t("sign_in_password")}
          </button>
          {error && <p data-cms-key="auth.error" style={{ fontSize: 13, color: "#f87171", textAlign: "center" }}>{error}</p>}
          <button
            type="button"
            onClick={() => { setPhase("methods"); setError(null); setPassword("") }}
            data-cms-key="auth.password.switch_to_otp"
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", textAlign: "center" }}
          >
            {t("switch_to_otp")}
          </button>
        </div>
      </motion.div>
    )
  }

  // ── Contact entry (phone / email tabbed) ────────────────────────────────────
  if (phase === "contact") {
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease: EASE }}>
        <button
          type="button"
          onClick={() => { setPhase("methods"); setError(null); setOtpStatus("input") }}
          aria-label={t("back")}
          style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", marginBottom: 16, fontSize: 14 }}
        >
          <ChevronLeft size={16} /> {t("back")}
        </button>

        {/* Tab switch */}
        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 4, marginBottom: 20 }}>
          {(["phone", "email"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => { setContactTab(tab); setError(null) }}
              data-cms-key={tab === "phone" ? "auth.contact.phone_tab" : "auth.contact.email_tab"}
              style={{
                flex: 1,
                height: 40,
                border: "none",
                borderRadius: 9,
                background: contactTab === tab ? "rgba(255,255,255,0.12)" : "transparent",
                color: contactTab === tab ? "#fff" : "rgba(255,255,255,0.5)",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
                transition: "background 0.15s ease, color 0.15s ease",
              }}
            >
              {tab === "phone" ? t("contact_phone_tab") : t("contact_email_tab")}
            </button>
          ))}
        </div>

        {contactTab === "phone" ? (
          <>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ display: "flex", alignItems: "center", padding: "0 14px", height: 50, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, color: "#fff", fontSize: 16 }}>+852</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("phone_placeholder")}
                inputMode="tel"
                autoComplete="tel"
                aria-label={t("phone_placeholder")}
                style={{ flex: 1, height: 50, background: "rgba(255,255,255,0.04)", border: `1px solid ${error ? "#f87171" : "rgba(255,255,255,0.12)"}`, borderRadius: 12, padding: "0 16px", color: "#fff", fontSize: 16, outline: "none", transition: "border-color 0.2s ease" }}
              />
            </div>
            <button
              type="button"
              onClick={sendOtp}
              disabled={busy}
              data-cms-key="auth.phone.send_code"
              style={{ marginTop: 12, width: "100%", height: 50, border: "none", borderRadius: 9999, background: busy ? "rgba(34,197,94,0.5)" : GREEN, color: "#000", fontWeight: 700, fontSize: 16, cursor: busy ? "not-allowed" : "pointer", transition: "background 0.2s ease" }}
            >
              {busy ? t("sending") : t("phone_send_code")}
            </button>
          </>
        ) : (
          <>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("email_placeholder")}
              inputMode="email"
              autoComplete="email"
              aria-label={t("email_placeholder")}
              style={{ height: 50, background: "rgba(255,255,255,0.04)", border: `1px solid ${error ? "#f87171" : "rgba(255,255,255,0.12)"}`, borderRadius: 12, padding: "0 16px", color: "#fff", fontSize: 16, outline: "none", transition: "border-color 0.2s ease" }}
            />
            <button
              type="button"
              onClick={sendEmailOtp}
              disabled={busy}
              data-cms-key="auth.email.continue"
              style={{ marginTop: 12, width: "100%", height: 50, border: "none", borderRadius: 9999, background: busy ? "rgba(34,197,94,0.5)" : GREEN, color: "#000", fontWeight: 700, fontSize: 16, cursor: busy ? "not-allowed" : "pointer", transition: "background 0.2s ease" }}
            >
              {busy ? t("sending") : t("email_continue")}
            </button>
          </>
        )}

        {error && <p data-cms-key="auth.error" style={{ marginTop: 12, fontSize: 13, color: "#f87171", textAlign: "center" }}>{error}</p>}

        <button
          type="button"
          onClick={() => { setPhase("password"); setError(null) }}
          data-cms-key="auth.switch_to_password"
          style={{ marginTop: 16, background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 12.5, cursor: "pointer", textAlign: "center", textDecoration: "underline", textUnderlineOffset: 2, textDecorationColor: "rgba(255,255,255,0.1)" }}
        >
          {t("switch_to_password")}
        </button>

        {/* reCAPTCHA compliance notice — only shown on the contact/OTP phase
            where reCAPTCHA is actually executed (sendOtp calls grecaptcha.execute).
            Required by Google when hiding the grecaptcha-badge. */}
        <p style={{ marginTop: 16, textAlign: "center", fontSize: 11, lineHeight: 1.6, color: "rgba(255,255,255,0.3)" }}>
          本網站受 reCAPTCHA 保護，適用 Google{' '}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "rgba(255,255,255,0.3)", textDecoration: "underline" }}
          >
            私隱政策
          </a>{' '}
          及{' '}
          <a
            href="https://policies.google.com/terms"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "rgba(255,255,255,0.3)", textDecoration: "underline" }}
          >
            服務條款
          </a>
          。
        </p>
      </motion.div>
    )
  }

  // ── Method picker ──────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Sign in with Apple */}
        <AppleSignInButton returnUrl={returnUrl} label={t("apple")} errorLabel={t("err_generic")} />

        <GoogleSignInButton
          returnUrl={returnUrl}
          onSignedIn={afterSignIn}
          fallbackLabel={t("google")}
          errorLabel={t("err_generic")}
        />

        {/* Phone / email — expands to a tabbed entry */}
        <button
          type="button"
          onClick={() => { setPhase("contact"); setError(null) }}
          data-cms-key="auth.contact.continue"
          style={{ width: "100%", height: 52, border: "1px solid rgba(255,255,255,0.14)", borderRadius: 9999, background: "rgba(255,255,255,0.04)", color: "#fff", fontWeight: 600, fontSize: 16, cursor: "pointer", transition: "background 0.2s ease" }}
        >
          {t("contact_continue")}
        </button>

        {error && phase === "methods" && (
          <p data-cms-key="auth.error" style={{ fontSize: 13, color: "#f87171", textAlign: "center", margin: 0 }}>{error}</p>
        )}

        {/* Password sign-in — subtle, de-emphasized */}
        <button
          type="button"
          onClick={() => { setPhase("password"); setError(null) }}
          data-cms-key="auth.switch_to_password"
          style={{ marginTop: 2, background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 12.5, cursor: "pointer", textAlign: "center", textDecoration: "underline", textUnderlineOffset: 2, textDecorationColor: "rgba(255,255,255,0.1)" }}
        >
          {t("switch_to_password")}
        </button>
      </div>

      <p data-cms-key="auth.terms" style={{ marginTop: 24, textAlign: "center", fontSize: 11, lineHeight: 1.6, color: "rgba(255,255,255,0.3)" }}>
        {t("terms")}
      </p>
    </div>
  )
}
