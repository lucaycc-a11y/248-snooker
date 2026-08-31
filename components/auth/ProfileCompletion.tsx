"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { validateProfile, normalizeHkPhone, type ProfileValidation } from "@/lib/auth/profile"
import { OtpVerification, type OtpVerificationStatus } from "./OtpVerification"

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
const OTP_LENGTH = 6
const RESEND_COOLDOWN = 60

type Grecaptcha = {
  execute: (siteKey: string, options: { action: string }) => Promise<string>
}

function isGrecaptcha(value: unknown): value is Grecaptcha {
  if (!value || typeof value !== "object") return false
  const candidate = value as { execute?: unknown }
  return typeof candidate.execute === "function"
}

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
// Phone verification (C2): a phone that is NOT already Supabase-SMS-verified is
// NOT accepted on the form alone. The submit button becomes "send verification
// code" — it runs reCAPTCHA, POSTs /api/otp/send (Engagelab issues the SMS),
// then /api/otp/verify-binding proves possession of the number BEFORE
// /api/profile/complete is allowed to run. The backend enforces the same rule
// (profile/complete returns 422 phone_not_verified for any unproven phone), so a
// direct API POST cannot skip this step (C2 item 6). SMS-login users keep their
// pre-verified phone locked via isPhoneVerified and skip straight to submit.
//
// This step does NOT set a password. Email/phone registrants already set one
// during signup (validated by lib/auth/password.ts), OAuth users don't need one,
// and changing a password is an email-link flow — so a weaker setter here would
// only be a way around the policy.
export function ProfileCompletion({
  initialName = "",
  initialEmail = "",
  initialPhone = "",
  isPhoneVerified = false,
  verifiedEmail,
  verifiedPhone,
  missingContact,
  onComplete,
  labels,
}: {
  initialName?: string
  initialEmail?: string
  initialPhone?: string
  isPhoneVerified?: boolean
  /** Already-verified email from auth_identities — hides the email field. */
  verifiedEmail?: string
  /** Already-verified phone from auth_identities — hides the phone field. */
  verifiedPhone?: string
  /** Which contact method the user still needs to provide. When set, only that
   *  field is shown. Undefined = show all fields (legacy fallback). */
  missingContact?: "phone" | "email"
  onComplete: (memberCode?: string) => void
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
    /** Label for the send-code button when the phone still needs OTP proof. */
    phone_send_code: string
    /** Link back to editing the number from the OTP sub-step, e.g. "Change number". */
    phone_change_number: string
  }
}) {
  const t = useTranslations("auth")
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const [phone, setPhone] = useState(() => localHkPhoneValue(initialPhone))
  const [saving, setSaving] = useState(false)
  const [errField, setErrField] = useState<"name" | "email" | "phone" | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  // Phone verification sub-step. True when an OTP was successfully redeemed via
  // /api/otp/verify-binding for this component's phone number.
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [verifyMode, setVerifyMode] = useState<"form" | "phoneOtp">("form")
  const [messageId, setMessageId] = useState("")
  const [otp, setOtp] = useState<string[]>(() => Array.from({ length: OTP_LENGTH }, () => ""))
  const [otpStatus, setOtpStatus] = useState<OtpVerificationStatus>("input")
  const [otpChannel, setOtpChannel] = useState<"whatsapp" | "sms">("sms")
  const [cooldown, setCooldown] = useState(0)

  // isPhoneVerified means the user already signed in via SMS — that number is
  // genuinely Supabase-verified, so keep it locked and skip the OTP sub-step.
  // Every other user (Apple/Google/Email) must prove the number with an OTP
  // before the profile can be completed.
  const phoneConfirmed = isPhoneVerified || phoneVerified

  // When missingContact is set, only validate the required field. Name is always
  // optional in this mode since the user's identity is already established via auth.
  const showEmail = missingContact !== "phone" && !verifiedEmail
  const showPhone = missingContact !== "email" && !verifiedPhone
  const showName = !missingContact // name only required in legacy (full-profile) mode

  const effectiveEmail = showEmail ? email : (verifiedEmail ?? initialEmail)
  const effectivePhone = showPhone ? phone : (verifiedPhone ?? initialPhone)
  const validation = showName
    ? validateProfile({ name, email: effectiveEmail, phone: effectivePhone })
    : missingContact === "phone"
      ? validateProfile({ name: name || " ", email: "x@x.com", phone: effectivePhone })
      : validateProfile({ name: name || " ", email: effectiveEmail, phone: "12345678" })
  const canSubmit = validation.ok && !saving

  const errorFor = (v: ProfileValidation): string => {
    if (v.ok) return ""
    return v.field === "name" ? labels.err_name : v.field === "email" ? labels.err_email : labels.err_phone
  }

  // Authoritative finalize. Only runs once the phone has genuine proof (SMS
  // sign-in, or an OTP just redeemed by verifyPhone). The server stamps
  // email_verified_at / phone_verified_at so the users_profile_complete_verified_chk
  // constraint holds — and independently rejects (422) any unproven phone.
  const submit = async () => {
    const v = validateProfile({ name, email: effectiveEmail, phone: effectivePhone })
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
        body: JSON.stringify({ name, email: v.value.email, phone: v.value.phone }),
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

      const responseData = await res.json()
      const memberCode = responseData.memberCode

      onComplete(memberCode)
    } catch {
      setErrMsg(labels.err_generic)
      setSaving(false)
    }
  }

  // Step 1 of the OTP sub-step: prove the human isn't a bot (reCAPTCHA), then
  // have Engagelab send a 6-digit code to the entered number.
  const sendPhoneCode = async () => {
    const v = validateProfile({ name, email: effectiveEmail, phone: effectivePhone })
    if (!v.ok) {
      setErrField(v.field)
      setErrMsg(errorFor(v))
      return
    }
    setErrField(null)
    setErrMsg(null)
    setSaving(true)
    try {
      const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
      const grecaptchaValue: unknown = typeof window === "undefined" ? undefined : window.grecaptcha
      if (!siteKey || !isGrecaptcha(grecaptchaValue)) {
        setErrMsg(labels.err_generic)
        setSaving(false)
        return
      }
      const recaptchaToken = await grecaptchaValue.execute(siteKey, { action: "send_otp" })
      const res = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: v.value.phone, recaptchaToken }),
      })
      const j = await res.json().catch(() => ({}))
      if (!j?.success) {
        setErrMsg(j?.error === "rate_limited" ? t("err_rate_limited") : j?.error || t("err_send"))
        setSaving(false)
        return
      }
      setMessageId(typeof j.messageId === "string" ? j.messageId : "")
      setOtpChannel(j?.channel === "whatsapp" ? "whatsapp" : "sms")
      setOtp(Array.from({ length: OTP_LENGTH }, () => ""))
      setOtpStatus("input")
      setCooldown(RESEND_COOLDOWN)
      setVerifyMode("phoneOtp")
    } catch {
      setErrMsg(t("err_network"))
    }
    setSaving(false)
  }

  // Step 2: redeem the OTP and BIND the phone to the account
  // (/api/otp/verify-binding writes phone + phone_verified_at), then finalize the
  // profile now that the server can stamp a genuine phone_verified_at.
  const verifyPhone = async (code: string) => {
    const v = validateProfile({ name, email: effectiveEmail, phone: effectivePhone })
    if (!v.ok) return
    if (!messageId) {
      setErrMsg(t("err_send"))
      setOtpStatus("failure")
      return
    }
    setSaving(true)
    setOtpStatus("verifying")
    setErrMsg(null)
    try {
      const res = await fetch("/api/otp/verify-binding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: v.value.phone, messageId, code }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.status === 409 && j?.status === "phone_taken") {
        setErrMsg(t("err_phone_exists"))
        setOtpStatus("failure")
        setSaving(false)
        return
      }
      // db_error: the code was CORRECT but the server failed to bind the phone
      // (transient DB/constraint issue). Never conflate with a wrong code.
      if (j?.error === "db_error") {
        setErrMsg(t("err_binding_failed_retry"))
        setOtpStatus("failure")
        setSaving(false)
        return
      }
      if (!res.ok || j?.success !== true) {
        setErrMsg(j?.error === "rate_limited" ? t("err_rate_limited") : t("err_otp_wrong_generic"))
        setOtpStatus("failure")
        setSaving(false)
        return
      }
      // j.alreadyVerified === true also lands here (res.ok, success: true): the
      // OTP was correct and the phone was already bound to this same account,
      // which is a success — fall through, finalize the profile.
      setPhoneVerified(true)
      setOtpStatus("success")
      await new Promise<void>((resolve) => window.setTimeout(resolve, 720))
      // submit() re-reads the phone state, which is unchanged and now proven;
      // on failure it drops back to the form where the verified badge shows.
      await submit()
    } catch {
      setErrMsg(t("err_network"))
      setOtpStatus("failure")
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

  const submitLabel = phoneConfirmed ? labels.submit : labels.phone_send_code

  // ── OTP sub-step ───────────────────────────────────────────────────────────
  // Shown only when the phone needs proving. The number is displayed read-only
  // (with a "change number" escape hatch back to the form); the verified badge
  // appears once the code is redeemed, right before the profile finalizes.
  if (verifyMode === "phoneOtp" && !phoneConfirmed) {
    return (
      <div>
        <h2
          data-cms-key="auth.profile.title"
          style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 30, letterSpacing: "0.02em", color: "#fff", marginBottom: 6 }}
        >
          {labels.title}
        </h2>
        <p data-cms-key="auth.profile.subtitle" style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 24 }}>
          {otpChannel === "whatsapp"
            ? t("otp_subtitle_whatsapp", { phone })
            : t("otp_subtitle", { phone })}
        </p>

        <OtpVerification
          length={OTP_LENGTH}
          value={otp}
          onChange={setOtp}
          onComplete={verifyPhone}
          status={otpStatus}
          error={errMsg}
          onReset={() => {
            setOtp(Array.from({ length: OTP_LENGTH }, () => ""))
            setErrMsg(null)
            setOtpStatus("input")
          }}
          disabled={saving}
        />

        <button
          type="button"
          onClick={sendPhoneCode}
          disabled={cooldown > 0 || saving}
          data-cms-key="auth.otp.resend"
          style={{ marginTop: 20, width: "100%", background: "none", border: "none", color: cooldown > 0 ? "rgba(255,255,255,0.35)" : GREEN, fontSize: 14, cursor: cooldown > 0 ? "default" : "pointer" }}
        >
          {cooldown > 0 ? t("resend_in", { seconds: cooldown }) : t("resend")}
        </button>

        <button
          type="button"
          onClick={() => {
            setVerifyMode("form")
            setErrMsg(null)
            setOtpStatus("input")
          }}
          data-cms-key="auth.profile.phone_change_number"
          style={{ marginTop: 8, width: "100%", background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", textAlign: "center", textDecoration: "underline", textUnderlineOffset: 2 }}
        >
          {labels.phone_change_number}
        </button>
      </div>
    )
  }

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
        {showName && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={labels.name}
            autoComplete="name"
            aria-label={labels.name}
            style={fieldStyle("name")}
          />
        )}
        {showEmail && (
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={labels.email}
            autoComplete="email"
            inputMode="email"
            aria-label={labels.email}
            style={fieldStyle("email")}
          />
        )}
        {showPhone && (
          <>
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
          </>
        )}

      </div>

      {errMsg && (
        <p data-cms-key="auth.profile.error" style={{ marginTop: 12, fontSize: 13, color: "#f87171" }}>
          {errMsg}
        </p>
      )}

      <button
        type="button"
        onClick={phoneConfirmed ? submit : sendPhoneCode}
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
        {saving ? labels.saving : submitLabel}
      </button>
    </div>
  )
}
