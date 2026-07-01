"use client"

import { useEffect, useState } from "react"
import { validateProfile, normalizeHkPhone, type ProfileValidation } from "@/lib/auth/profile"
import { createClient } from "@/lib/supabase/client"
import { OtpInput } from "./OtpInput"

const BRASS = "#c9a876"
const DEEP = "#0a1a0f"
const GREEN = "#22c55e"
const OTP_LENGTH = 6
const RESEND_COOLDOWN = 30
const MAX_OTP_ATTEMPTS = 3

function localHkPhoneValue(value: string): string {
  const normalized = normalizeHkPhone(value)
  return normalized ? normalized.slice(4) : value
}

type PhoneOtpPhase = "idle" | "sent"

// Mandatory first-sign-in profile step. Name + email + phone are ALL required for
// every method (SMS users lack email; Apple/Google/Email users lack a verified
// phone). Validates client-side for instant feedback, then POSTs to
// /api/profile/complete which re-validates authoritatively. Cannot be dismissed —
// the parent renders it as a blocking step and only advances on the onComplete
// callback.
//
// Phone verification: unless the user already signed in via SMS (isPhoneVerified),
// the phone field requires an explicit send-code → enter-code round trip before
// Continue is enabled — never just format-valid free text. Uses
// supabase.auth.updateUser({ phone }) to stage the number, then verifyOtp with
// type: 'phone_change' (NOT 'sms' — the SDK checks the pending phone_change field
// under that type, not the account's primary phone field; using 'sms' here
// silently fails to ever confirm it).
export function ProfileCompletion({
  initialName = "",
  initialEmail = "",
  initialPhone = "",
  isPhoneVerified = false,
  onComplete,
  labels,
}: {
  initialName?: string
  initialEmail?: string
  initialPhone?: string
  isPhoneVerified?: boolean
  onComplete: () => void
  labels: {
    title: string
    subtitle: string
    name: string
    email: string
    phone: string
    submit: string
    saving: string
    err_name: string
    err_email: string
    err_phone: string
    err_generic: string
    /** Button label to trigger the phone OTP send. */
    phone_send_code: string
    /** Shown once verified, e.g. "Verified". */
    phone_verified_badge: string
    /** "{phone}" placeholder, e.g. "We sent a 6-digit code to +852 {phone}". */
    phone_otp_subtitle: string
    phone_resend: string
    /** "{seconds}" placeholder. */
    phone_resend_in: string
    phone_change_number: string
    err_otp_wrong: string // "{count}" placeholder
    err_otp_expired: string
    err_otp_locked: string
  }
}) {
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const [phone, setPhone] = useState(() => localHkPhoneValue(initialPhone))
  const [saving, setSaving] = useState(false)
  const [errField, setErrField] = useState<"name" | "email" | "phone" | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  // Phone verification sub-state — independent of the top-level save/submit flow.
  const [phoneOtpPhase, setPhoneOtpPhase] = useState<PhoneOtpPhase>("idle")
  const [phoneVerifiedNow, setPhoneVerifiedNow] = useState(false)
  const [otp, setOtp] = useState("")
  const [otpBusy, setOtpBusy] = useState(false)
  const [otpError, setOtpError] = useState<string | null>(null)
  const [otpAttemptsLeft, setOtpAttemptsLeft] = useState(MAX_OTP_ATTEMPTS)
  const [otpCooldown, setOtpCooldown] = useState(0)

  // Resend cooldown ticker.
  useEffect(() => {
    if (otpCooldown <= 0) return
    const id = setInterval(() => setOtpCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(id)
  }, [otpCooldown])

  const phoneConfirmed = isPhoneVerified || phoneVerifiedNow
  const validation = validateProfile({ name, email, phone })
  const canSubmit = validation.ok && phoneConfirmed && !saving
  const phoneMessage = !phoneConfirmed && phoneOtpPhase === "idle" && !normalizeHkPhone(phone) ? labels.err_phone : null

  const errorFor = (v: ProfileValidation): string => {
    if (v.ok) return ""
    return v.field === "name" ? labels.err_name : v.field === "email" ? labels.err_email : labels.err_phone
  }

  const sendPhoneCode = async () => {
    const normalized = normalizeHkPhone(phone)
    if (!normalized) {
      setErrField("phone")
      setErrMsg(labels.err_phone)
      return
    }
    setOtpBusy(true)
    setOtpError(null)
    setErrMsg(null)
    setErrField(null)
    try {
      const supabase = createClient()
      // Stages the number in auth.users.phone_change (not the primary phone
      // field yet) and sends the SMS — this is the correct way to add/verify a
      // phone for an ALREADY-authenticated session (Apple/Google/Email users).
      const { error } = await supabase.auth.updateUser({ phone: normalized })
      if (error) {
        console.error("[ProfileCompletion] updateUser(phone) failed", {
          message: error.message,
          status: (error as { status?: number }).status,
        })
        setOtpError(labels.err_generic)
        setOtpBusy(false)
        return
      }
      setOtp("")
      setOtpAttemptsLeft(MAX_OTP_ATTEMPTS)
      setOtpCooldown(RESEND_COOLDOWN)
      setOtpBusy(false)
      setPhoneOtpPhase("sent")
    } catch {
      setOtpError(labels.err_generic)
      setOtpBusy(false)
    }
  }

  const verifyPhoneCode = async (code: string) => {
    const normalized = normalizeHkPhone(phone)
    if (!normalized) return
    setOtpBusy(true)
    setOtpError(null)
    const supabase = createClient()
    // type: 'phone_change', NOT 'sms' — this confirms the pending phone_change
    // staged by updateUser() above. 'sms' checks the (empty) primary phone field
    // and would silently never succeed for this flow.
    const { error } = await supabase.auth.verifyOtp({
      phone: normalized,
      token: code,
      type: "phone_change",
    })
    if (error) {
      const expired = /expired/i.test(error.message)
      const remaining = otpAttemptsLeft - 1
      setOtpAttemptsLeft(remaining)
      setOtp("")
      if (expired) {
        setOtpError(labels.err_otp_expired)
      } else if (remaining > 0) {
        setOtpError(labels.err_otp_wrong.replace("{count}", String(remaining)))
      } else {
        setOtpError(labels.err_otp_locked)
        setPhoneOtpPhase("idle")
      }
      setOtpBusy(false)
      return
    }
    setPhoneVerifiedNow(true)
    setPhoneOtpPhase("idle")
    setOtpBusy(false)
  }

  const submit = async () => {
    if (!phoneConfirmed) {
      setErrField("phone")
      setErrMsg(labels.err_phone)
      return
    }
    const v = validateProfile({ name, email, phone })
    if (!v.ok) {
      setErrField(v.field)
      setErrMsg(errorFor(v))
      return
    }
    setErrField(null)
    setErrMsg(null)
    setSaving(true)
    try {
      const res = await fetch("/api/profile/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone: v.value.phone }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        if (res.status === 422 && j.field) {
          setErrField(j.field)
          setErrMsg(j.field === "name" ? labels.err_name : j.field === "email" ? labels.err_email : labels.err_phone)
        } else {
          setErrMsg(labels.err_generic)
        }
        setSaving(false)
        return
      }
      onComplete()
    } catch {
      setErrMsg(labels.err_generic)
      setSaving(false)
    }
  }

  const fieldStyle = (field: "name" | "email" | "phone") => ({
    width: "100%",
    height: 52,
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${errField === field ? "#f87171" : "rgba(255,255,255,0.14)"}`,
    borderRadius: 12,
    padding: "0 16px",
    color: "#fff",
    fontSize: 16,
    outline: "none",
  })

  return (
    <div>
      <h2
        data-cms-key="auth.profile.title"
        style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 30, letterSpacing: "0.02em", color: "#fff", marginBottom: 6 }}
      >
        {labels.title}
      </h2>
      <p data-cms-key="auth.profile.subtitle" style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 24 }}>
        {labels.subtitle}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={labels.name}
          autoComplete="name"
          aria-label={labels.name}
          style={fieldStyle("name")}
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={labels.email}
          autoComplete="email"
          inputMode="email"
          aria-label={labels.email}
          style={fieldStyle("email")}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ display: "flex", alignItems: "center", padding: "0 14px", height: 52, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, color: "#fff", fontSize: 16 }}>
            +852
          </span>
          <input
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value.replace(/\D/g, "").slice(0, 8))
              // Editing after a send/verify invalidates whatever was staged.
              setPhoneVerifiedNow(false)
              setPhoneOtpPhase("idle")
            }}
            placeholder={labels.phone}
            autoComplete="tel-national"
            inputMode="numeric"
            pattern="[0-9]{8}"
            maxLength={8}
            required
            disabled={phoneConfirmed}
            aria-label={labels.phone}
            aria-invalid={errField === "phone" || (!validation.ok && validation.field === "phone")}
            style={{
              ...fieldStyle("phone"),
              flex: 1,
              opacity: phoneConfirmed ? 0.65 : 1,
              cursor: phoneConfirmed ? "not-allowed" : "text",
            }}
          />
        </div>

        {/* Phone verification sub-flow — hidden once already verified (SMS
            sign-in) or verified in this session. */}
        {!phoneConfirmed && phoneOtpPhase === "idle" && (
          <button
            type="button"
            onClick={sendPhoneCode}
            disabled={otpBusy || !normalizeHkPhone(phone)}
            data-cms-key="auth.profile.phone_send_code"
            style={{
              width: "100%",
              height: 44,
              border: `1px solid ${GREEN}`,
              borderRadius: 9999,
              background: "transparent",
              color: GREEN,
              fontWeight: 600,
              fontSize: 14,
              cursor: otpBusy || !normalizeHkPhone(phone) ? "not-allowed" : "pointer",
              opacity: otpBusy || !normalizeHkPhone(phone) ? 0.5 : 1,
            }}
          >
            {otpBusy ? labels.saving : labels.phone_send_code}
          </button>
        )}

        {phoneVerifiedNow && (
          <div
            data-cms-key="auth.profile.phone_verified_badge"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: GREEN }}
          >
            ✓ {labels.phone_verified_badge}
          </div>
        )}

        {!phoneConfirmed && phoneOtpPhase === "sent" && (
          <div style={{ marginTop: 4 }}>
            <p data-cms-key="auth.profile.phone_otp_subtitle" style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 12 }}>
              {labels.phone_otp_subtitle.replace("{phone}", phone)}
            </p>
            <OtpInput
              length={OTP_LENGTH}
              value={otp}
              onChange={setOtp}
              onComplete={verifyPhoneCode}
              disabled={otpBusy}
              invalid={!!otpError}
            />
            {otpError && (
              <p style={{ marginTop: 10, fontSize: 13, color: "#f87171", textAlign: "center" }}>{otpError}</p>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
              <button
                type="button"
                onClick={() => { setPhoneOtpPhase("idle"); setOtpError(null); setOtp("") }}
                data-cms-key="auth.profile.phone_change_number"
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer" }}
              >
                {labels.phone_change_number}
              </button>
              <button
                type="button"
                onClick={sendPhoneCode}
                disabled={otpCooldown > 0 || otpBusy}
                data-cms-key="auth.profile.phone_resend"
                style={{ background: "none", border: "none", color: otpCooldown > 0 ? "rgba(255,255,255,0.35)" : GREEN, fontSize: 13, cursor: otpCooldown > 0 ? "default" : "pointer" }}
              >
                {otpCooldown > 0 ? labels.phone_resend_in.replace("{seconds}", String(otpCooldown)) : labels.phone_resend}
              </button>
            </div>
          </div>
        )}
      </div>

      {phoneMessage && !errMsg && (
        <p data-cms-key="auth.profile.phone_hint" style={{ marginTop: 12, fontSize: 13, color: "#f87171" }}>
          {phoneMessage}
        </p>
      )}

      {errMsg && (
        <p data-cms-key="auth.profile.error" style={{ marginTop: 12, fontSize: 13, color: "#f87171" }}>
          {errMsg}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        data-cms-key="auth.profile.submit"
        style={{
          marginTop: 24,
          width: "100%",
          height: 52,
          border: "none",
          borderRadius: 12,
          background: canSubmit ? BRASS : "rgba(201,168,118,0.5)",
          color: DEEP,
          fontWeight: 700,
          fontSize: 16,
          cursor: canSubmit ? "pointer" : "not-allowed",
        }}
      >
        {saving ? labels.saving : labels.submit}
      </button>
    </div>
  )
}
