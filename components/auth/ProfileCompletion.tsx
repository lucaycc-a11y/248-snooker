"use client"

import { useState } from "react"
import { validateProfile, normalizeHkPhone, type ProfileValidation } from "@/lib/auth/profile"

// Matches the GREEN constant duplicated across every other auth-flow file
// (AuthCard.tsx, AuthModal.tsx, AccountMenu.tsx, OtpInput.tsx,
// SignInPrompt.tsx) — this file previously used its own unrelated "BRASS"
// (#c9a876) gold constant instead, which is why this submit button kept
// reverting to gold after earlier fixes: those fixes touched the other
// auth buttons, never this file's hardcoded constant.
// NOTE: this is intentionally NOT tokens.colors.brand (#25D366, WhatsApp
// green) — every hand-rolled auth button in this flow uses #22c55e, so
// matching that (not the shared Button component's token) is what keeps
// this button visually consistent with its siblings.
const GREEN = "#22c55e"

function localHkPhoneValue(value: string): string {
  const normalized = normalizeHkPhone(value)
  return normalized ? normalized.slice(4) : value
}

// Mandatory first-sign-in profile step. Name + email + phone are ALL required for
// every method (SMS users lack email; Apple/Google/Email users lack a verified
// phone). Validates client-side for instant feedback, then POSTs to
// /api/profile/complete which re-validates authoritatively. Cannot be dismissed —
// the parent renders it as a blocking step and only advances on the onComplete
// callback.
//
// Phone is format-checked only (8 digits) — NOT SMS-verified — for Apple/Google/
// Email users; it's written straight to public.users.phone, never through
// supabase.auth.updateUser/verifyOtp (those touch auth.users.phone, which is
// reserved for actually-SMS-verified numbers). Existing SMS-login users keep
// their pre-verified phone locked via isPhoneVerified, unaffected by this.
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
    /** Shown when phone was already verified via SMS sign-in, e.g. "Verified". */
    phone_verified_badge: string
  }
}) {
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const [phone, setPhone] = useState(() => localHkPhoneValue(initialPhone))
  const [saving, setSaving] = useState(false)
  const [errField, setErrField] = useState<"name" | "email" | "phone" | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  // isPhoneVerified means the user already signed in via SMS — that number is
  // genuinely Supabase-verified, so keep it locked. Every other user (Apple/
  // Google/Email) just needs a format-valid number; no verification step.
  const phoneConfirmed = isPhoneVerified
  const validation = validateProfile({ name, email, phone })
  const canSubmit = validation.ok && !saving

  const errorFor = (v: ProfileValidation): string => {
    if (v.ok) return ""
    return v.field === "name" ? labels.err_name : v.field === "email" ? labels.err_email : labels.err_phone
  }

  const submit = async () => {
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
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 8))}
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

        {phoneConfirmed && (
          <div
            data-cms-key="auth.profile.phone_verified_badge"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#22c55e" }}
          >
            ✓ {labels.phone_verified_badge}
          </div>
        )}
      </div>

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
          background: canSubmit ? GREEN : "rgba(34,197,94,0.5)",
          color: "#000",
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
