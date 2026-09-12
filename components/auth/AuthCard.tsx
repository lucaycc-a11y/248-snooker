"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft } from "lucide-react"
import { useTranslations } from "next-intl"
import { createClient } from "@/lib/supabase/client"
import { normalizeHkPhone } from "@/lib/auth/profile"
import { validatePassword } from "@/lib/auth/password"
import { getRecaptchaToken } from "@/lib/recaptcha"
import { LoadingGif } from "@/components/ui/LoadingGif"
import { PasswordInput } from "@/components/ui/PasswordInput"
import PasswordStrength from "./PasswordStrength"
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

type Phase = "methods" | "contact" | "otp" | "profile" | "password" | "signup" | "signupPhone" | "signupEmail"
type OtpChannel = "sms" | "email"
type OtpDeliveryChannel = "whatsapp" | "sms"
type ContactType = "phone" | "email" | "unknown"
type Prefill = { name: string; email: string; phone: string; phoneVerified: boolean }

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
  const [contact, setContact] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [signupName, setSignupName] = useState("")
  const [signupEmail, setSignupEmail] = useState("")
  const [signupPhone, setSignupPhone] = useState("")
  const [signupPassword, setSignupPassword] = useState("")
  const [signupId, setSignupId] = useState("")
  const [signupMessageId, setSignupMessageId] = useState("")
  const [otpChannel, setOtpChannel] = useState<OtpChannel>("sms")
  const [messageId, setMessageId] = useState("")
  const [otpDeliveryChannel, setOtpDeliveryChannel] = useState<OtpDeliveryChannel>("sms")
  const [otp, setOtp] = useState<string[]>(() => Array.from({ length: OTP_LENGTH }, () => ""))
  const [otpStatus, setOtpStatus] = useState<OtpVerificationStatus>("input")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_OTP_ATTEMPTS)
  const [cooldown, setCooldown] = useState(0)
  const [otpExpiresAt, setOtpExpiresAt] = useState<string | null>(null)
  const [prefill, setPrefill] = useState<Prefill>({ name: "", email: "", phone: "", phoneVerified: false })
  // True until the mount-time session check resolves — avoids flashing the method
  // picker to a user who's already signed in (e.g. returning from an OAuth redirect).
  const [initializing, setInitializing] = useState(true)
  const didInit = useRef(false)
  // QR guide modal — shown after first profile completion (new registration).
  const [qrMemberCode, setQrMemberCode] = useState<string | null>(null)

  // Onboarding-aware identity context. When a user reaches the profile gate,
  // these tell ProfileCompletion which contact is already verified and which
  // still needs to be provided — so only the missing field is shown.
  const [verifiedEmail, setVerifiedEmail] = useState<string | undefined>(undefined)
  const [verifiedPhone, setVerifiedPhone] = useState<string | undefined>(undefined)
  const [missingContact, setMissingContact] = useState<"phone" | "email" | undefined>(undefined)

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
        .select("display_name, email, phone, profile_complete, onboarding_status")
        .eq("id", user.id)
        .maybeSingle()
      if (cancelled) return
      if (data?.onboarding_status === "complete" || data?.profile_complete === true) {
        onAuthComplete()
        return
      }

      // Query auth_identities to determine which contact is already verified
      const { data: identities } = await supabase
        .from("auth_identities")
        .select("provider, identifier, verified")
        .eq("user_id", user.id)
        .eq("verified", true)
      if (cancelled) return

      const hasEmail = identities?.some(i => i.provider === "email" || i.provider === "google" || i.provider === "apple") ?? false
      const hasPhone = identities?.some(i => i.provider === "phone") ?? false
      const idEmail = identities?.find(i => i.provider === "email")?.identifier
      const idPhone = identities?.find(i => i.provider === "phone")?.identifier

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
      setVerifiedEmail(idEmail ?? data?.email ?? user.email ?? undefined)
      setVerifiedPhone(idPhone ?? (verifiedPhone || undefined))
      setMissingContact(hasEmail && !hasPhone ? "phone" : hasPhone && !hasEmail ? "email" : undefined)
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
      .select("display_name, email, phone, profile_complete, onboarding_status")
      .eq("id", user.id)
      .maybeSingle()

    // Canonical gate: onboarding_status is the primary check, profile_complete is legacy fallback
    if (data?.onboarding_status === "complete" || data?.profile_complete === true) {
      onAuthComplete()
      return
    }

    // Query auth_identities to determine which contact is already verified
    const { data: identities } = await supabase
      .from("auth_identities")
      .select("provider, identifier, verified")
      .eq("user_id", user.id)
      .eq("verified", true)

    const hasEmail = identities?.some(i => i.provider === "email" || i.provider === "google" || i.provider === "apple") ?? false
    const hasPhone = identities?.some(i => i.provider === "phone") ?? false
    const idEmail = identities?.find(i => i.provider === "email")?.identifier
    const idPhone = identities?.find(i => i.provider === "phone")?.identifier

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
    setVerifiedEmail(idEmail ?? data?.email ?? user.email ?? undefined)
    setVerifiedPhone(idPhone ?? (verifiedPhone || undefined))
    setMissingContact(hasEmail && !hasPhone ? "phone" : hasPhone && !hasEmail ? "email" : undefined)
    setBusy(false)
    setPhase("profile")
  }, [onAuthComplete, t, phone])

  // Registration is email-first: /api/auth/signup emails a code, verify-email
  // then triggers the SMS, and verify-phone creates the account once both
  // contacts are proven. Keep this order in step with lib/auth/signup-state.ts.
  const sendSignup = async () => {
    const normalized = normalizeHkPhone(signupPhone)
    if (!signupName.trim()) { setError(t("err_name")); return }
    if (!signupEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail.trim())) { setError(t("err_email")); return }
    if (!normalized) { setError(t("err_phone")); return }
    if (!validatePassword(signupPassword).ok) { setError(t("err_password_weak")); return }
    setBusy(true); setError(null)
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: signupName, email: signupEmail, phone: normalized, password: signupPassword }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || j?.ok !== true) {
        setError(j?.error === "email_exists" ? t("err_email_exists") : j?.error === "phone_exists" || j?.error === "identity_in_use" ? t("err_phone_exists") : j?.error === "weak_password" ? t("err_password_weak") : j?.error === "rate_limited" ? t("err_rate_limited") : t("err_send"))
        setBusy(false); return
      }
      setSignupId(typeof j.signupId === "string" ? j.signupId : "")
      setPhone(normalized); setEmail(signupEmail.trim())
      setOtp([]); setOtpStatus("input"); setAttemptsLeft(MAX_OTP_ATTEMPTS); setCooldown(RESEND_COOLDOWN)
      setOtpChannel("email")
      setPhase("signupEmail")
    } catch { setError(t("err_network")) }
    setBusy(false)
  }

  // Step 1: redeem the email code; the response carries the SMS message id.
  const verifySignupEmail = async (code: string) => {
    if (!signupId) return
    setBusy(true); setOtpStatus("verifying"); setError(null)
    try {
      const res = await fetch("/api/auth/signup/verify-email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signupId, code }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || j?.ok !== true || typeof j.messageId !== "string") {
        // signup_expired / send_failed kill the attempt server-side, so keeping
        // the user on the code screen would be a dead end — send them back to
        // the form instead of showing an error they cannot act on.
        if (j?.error === "signup_expired" || j?.error === "send_failed") {
          setError(t("err_signup_expired")); setOtpStatus("input"); setOtp([]); setSignupId(""); setPhase("signup"); setBusy(false); return
        }
        setError(j?.error === "invalid_code" ? t("err_otp_wrong_generic") : j?.error === "too_many_attempts" ? t("err_otp_locked") : t("err_generic"))
        setOtpStatus("failure"); setBusy(false); return
      }
      setSignupMessageId(j.messageId); setMessageId(j.messageId)
      setOtpStatus("input"); setOtp([]); setCooldown(RESEND_COOLDOWN)
      setOtpChannel("sms"); setOtpDeliveryChannel(j.channel === "whatsapp" ? "whatsapp" : "sms")
      setPhase("signupPhone")
    } catch { setError(t("err_network")); setOtpStatus("failure") }
    setBusy(false)
  }

  // Step 2: redeem the SMS code. The account is created server-side and we
  // exchange the returned token hash through Supabase's own verifyOtp.
  const verifySignupPhone = async (code: string) => {
    if (!signupId || !signupMessageId) return
    setBusy(true); setOtpStatus("verifying"); setError(null)
    try {
      const res = await fetch("/api/auth/signup/verify-phone", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signupId, phone: signupPhone, messageId: signupMessageId, code }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || j?.ok !== true || typeof j.tokenHash !== "string") {
        if (j?.error === "signup_expired") {
          setError(t("err_signup_expired")); setOtpStatus("input"); setOtp([]); setSignupId(""); setSignupMessageId(""); setPhase("signup"); setBusy(false); return
        }
        setError(j?.error === "invalid_code" ? t("err_otp_wrong_generic") : j?.error === "email_exists" ? t("err_email_exists") : j?.error === "identity_in_use" ? t("err_phone_exists") : t("err_generic"))
        setOtpStatus("failure"); setBusy(false); return
      }
      const supabase = createClient()
      const { error: sessionError } = await supabase.auth.verifyOtp({ token_hash: j.tokenHash, type: "magiclink" })
      if (sessionError) { setError(t("err_generic")); setOtpStatus("failure"); setBusy(false); return }
      setOtpStatus("success")
      await new Promise<void>((resolve) => window.setTimeout(resolve, 720))
      onAuthComplete()
    } catch { setError(t("err_network")); setOtpStatus("failure") }
    setBusy(false)
  }

  // Detect contact type: email (contains @), phone (8 digits), or unknown
  const detectContactType = (input: string): ContactType => {
    const trimmed = input.trim()
    if (!trimmed) return "unknown"

    // Email detection: contains @ and basic email pattern
    if (trimmed.includes("@") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return "email"
    }

    // Phone detection: handle multiple formats for autofill compatibility
    // 1. Pure 8 digits: 66009975
    // 2. With 852 prefix: 85266009975 (11 digits starting with 852)
    // 3. With +852 prefix: +85266009975 (autofill format)
    const digitsOnly = trimmed.replace(/\D/g, "")

    // Check: exactly 8 digits
    if (digitsOnly.length === 8 && /^\d{8}$/.test(digitsOnly)) {
      return "phone"
    }

    // Check: 11 digits starting with 852 (852 + 8 digits)
    if (digitsOnly.length === 11 && digitsOnly.startsWith("852")) {
      return "phone"
    }

    // Check: +852 format (will be 12 chars with +, 11 digits without)
    if (trimmed.startsWith("+852") && digitsOnly.length === 11 && digitsOnly.startsWith("852")) {
      return "phone"
    }

    return "unknown"
  }

  // Extract normalized phone number from various input formats
  const extractPhoneNumber = (input: string): string => {
    const trimmed = input.trim()
    const digitsOnly = trimmed.replace(/\D/g, "")

    // If it's 11 digits starting with 852, extract last 8 digits
    if (digitsOnly.length === 11 && digitsOnly.startsWith("852")) {
      return `+852${digitsOnly.slice(3)}`
    }

    // If it's 8 digits, prepend +852
    if (digitsOnly.length === 8) {
      return `+852${digitsOnly}`
    }

    // Fallback: return as-is if already has +852
    if (trimmed.startsWith("+852")) {
      return trimmed
    }

    return `+852${digitsOnly}`
  }

  // Unified send function that detects format and routes appropriately
  const sendContactOtp = async () => {
    const contactType = detectContactType(contact)

    if (contactType === "unknown") {
      setError(t("err_contact_format"))
      return
    }

    if (contactType === "email") {
      const trimmed = contact.trim()
      setEmail(trimmed)
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
        setOtpExpiresAt(null)
        setAttemptsLeft(MAX_OTP_ATTEMPTS)
        setCooldown(RESEND_COOLDOWN)
        setBusy(false)
        setPhase("otp")
      } catch {
        setError(t("err_network"))
        setBusy(false)
      }
    } else {
      // Phone path: extract and normalize phone number (handles +852, 852, or 8-digit formats)
      const normalized = extractPhoneNumber(contact)
      setPhone(normalized)

      setBusy(true)
      setError(null)
      try {
        let recaptchaToken: string
        try {
          recaptchaToken = await getRecaptchaToken("send_otp")
        } catch {
          setError(t("err_send"))
          setBusy(false)
          return
        }

        const res = await fetch("/api/otp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: normalized, recaptchaToken }),
        })
        const j = await res.json().catch(() => ({}))

        if (!res.ok || !j?.success) {
          if (j?.code === "PHONE_NOT_REGISTERED") {
            setError(t("err_phone_not_registered"))
          } else if (j?.code === "OTP_COOLDOWN" || j?.code === "OTP_RATE_LIMITED" || j?.error === "rate_limited") {
            setError(t("err_rate_limited"))
          } else if (j?.code === "PHONE_LOCKED" || j?.code === "CAPTCHA_REQUIRED") {
            setError(t("err_rate_limited"))
          } else if (j?.code === "PHONE_INVALID") {
            setError(t("err_phone"))
          } else {
            setError(t("err_send"))
          }
          setBusy(false)
          return
        }

        setOtp(Array.from({ length: OTP_LENGTH }, () => ""))
        setOtpStatus("input")
        setOtpChannel("sms")
        setMessageId(typeof j?.messageId === "string" ? j.messageId : "")
        setOtpExpiresAt(typeof j?.expiresAt === "string" ? j.expiresAt : null)
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
  }

  const sendOtp = async () => {
    const normalized = normalizeHkPhone(phone)
    if (!normalized) {
      setError(t("err_phone"))
      return
    }
    setBusy(true)
    setError(null)
    try {
      let recaptchaToken: string
      try {
        recaptchaToken = await getRecaptchaToken("send_otp")
      } catch {
        setError(t("err_send"))
        setBusy(false)
        return
      }

      const res = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized, recaptchaToken }),
      })
      const j = await res.json().catch(() => ({}))

      if (!res.ok || !j?.success) {
        if (j?.code === "PHONE_NOT_REGISTERED") {
          setError(t("err_phone_not_registered"))
        } else if (j?.code === "OTP_COOLDOWN" || j?.code === "OTP_RATE_LIMITED" || j?.error === "rate_limited") {
          setError(t("err_rate_limited"))
        } else if (j?.code === "PHONE_LOCKED" || j?.code === "CAPTCHA_REQUIRED") {
          setError(t("err_rate_limited"))
        } else if (j?.code === "PHONE_INVALID") {
          setError(t("err_phone"))
        } else {
          setError(t("err_send"))
        }
        setBusy(false)
        return
      }

      setOtp(Array.from({ length: OTP_LENGTH }, () => ""))
      setOtpStatus("input")
      setOtpChannel("sms")
      setMessageId(typeof j?.messageId === "string" ? j.messageId : "")
      setOtpExpiresAt(typeof j?.expiresAt === "string" ? j.expiresAt : null)
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
      setOtpExpiresAt(null)
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
    const identifier = contact.trim()
    if (!identifier) {
      setError(t("err_identifier"))
      return
    }
    if (!password) {
      setError(t("err_password"))
      return
    }

    // Detect if identifier is phone or email
    const contactType = detectContactType(identifier)
    if (contactType === "unknown") {
      setError(t("err_identifier"))
      return
    }

    setBusy(true)
    setError(null)
    try {
      const supabase = createClient()

      // Build auth input based on contact type
      let authInput: { email: string; password: string } | { phone: string; password: string }

      if (contactType === "phone") {
        const normalized = extractPhoneNumber(identifier)
        authInput = { phone: normalized, password }
        setPhone(normalized)
      } else {
        authInput = { email: identifier.toLowerCase(), password }
        setEmail(identifier.toLowerCase())
      }

      const { error: signInErr } = await supabase.auth.signInWithPassword(authInput)
      if (signInErr) {
        const message = signInErr.message.toLowerCase()
        if (signInErr.status === 429 || signInErr.code === "over_request_rate_limit") {
          setError(t("err_rate_limited"))
        } else if (
          signInErr.code === "invalid_credentials" ||
          signInErr.code === "user_not_found" ||
          (!signInErr.code && message === "invalid login credentials")
        ) {
          // Do not distinguish missing accounts or unset passwords from wrong credentials.
          // Keeping the same message avoids introducing an account-enumeration signal.
          setError(t("err_password"))
        } else if (signInErr.code === "email_not_confirmed") {
          // Only use the explicit Auth code; do not infer account state from arbitrary messages.
          setError(t("err_password_email_unconfirmed"))
        } else {
          setError(t("err_password_unknown"))
        }
        return
      }
      await afterSignIn()
    } catch (error: unknown) {
      console.error("Password sign-in failed", error)
      setError(t("err_password_unknown"))
    } finally {
      setBusy(false)
    }
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
          setOtpStatus("locked")
          setBusy(false)
          return
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
        setOtpStatus("locked")
        setBusy(false)
        return
      }
      setOtpStatus("failure")
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
        verifiedEmail={verifiedEmail}
        verifiedPhone={verifiedPhone}
        missingContact={missingContact}
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
          phone_send_code: t("profile_phone_send_code"),
          phone_change_number: t("profile_phone_change_number"),
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

  // ── Signup details ──────────────────────────────────────────────────────────
  if (phase === "signup") {
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease: EASE }}>
        <button type="button" onClick={() => { setPhase("methods"); setError(null) }} aria-label={t("back")} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", marginBottom: 16, fontSize: 14 }}><ChevronLeft size={16} /> {t("back")}</button>
        <h2 style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 30, color: "#fff", marginBottom: 6 }}>{t("signup_title")}</h2>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 24 }}>{t("signup_subtitle")}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input value={signupName} onChange={(e) => setSignupName(e.target.value)} placeholder={t("profile_name")} autoComplete="name" aria-label={t("profile_name")} style={{ height: 52, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, padding: "0 16px", color: "#fff", fontSize: 16, outline: "none" }} />
          <input value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} placeholder={t("email_placeholder")} autoComplete="email" aria-label={t("email_placeholder")} style={{ height: 52, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, padding: "0 16px", color: "#fff", fontSize: 16, outline: "none" }} />
          <input value={signupPhone} onChange={(e) => setSignupPhone(e.target.value)} placeholder={t("phone_placeholder")} inputMode="tel" autoComplete="tel" aria-label={t("phone_placeholder")} style={{ height: 52, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, padding: "0 16px", color: "#fff", fontSize: 16, outline: "none" }} />
          <input value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} placeholder={t("password_required")} type="password" autoComplete="new-password" aria-label={t("password_required")} style={{ height: 52, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, padding: "0 16px", color: "#fff", fontSize: 16, outline: "none" }} />
          <PasswordStrength value={signupPassword} />
          <button type="button" onClick={sendSignup} disabled={busy} style={{ width: "100%", height: 52, border: "none", borderRadius: 9999, background: busy ? "rgba(34,197,94,0.5)" : GREEN, color: "#000", fontWeight: 700, fontSize: 16, cursor: busy ? "not-allowed" : "pointer" }}>{busy ? t("sending") : t("signup_continue")}</button>
        </div>
        {error && <p role="alert" style={{ marginTop: 12, fontSize: 13, color: "#f87171", textAlign: "center" }}>{error}</p>}
      </motion.div>
    )
  }

  if (phase === "signupPhone" || phase === "signupEmail") {
    const phoneStep = phase === "signupPhone"
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease: EASE }}>
        {/* The email step can return to the form, but once the email code is
            consumed the attempt has advanced server-side, so the phone step
            abandons to the method picker rather than offering a dead-end back. */}
        <button type="button" onClick={() => { setPhase(phoneStep ? "methods" : "signup"); setError(null); setOtpStatus("input") }} aria-label={t("back")} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", marginBottom: 16, fontSize: 14 }}><ChevronLeft size={16} /> {t("back")}</button>
        <h2 style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 30, color: "#fff", marginBottom: 6 }}>{phoneStep ? t("signup_phone_title") : t("signup_email_title")}</h2>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 24 }}>{phoneStep ? t(otpDeliveryChannel === "whatsapp" ? "otp_subtitle_whatsapp" : "otp_subtitle", { phone: signupPhone }) : t("otp_subtitle_email", { email: signupEmail })}</p>
        <OtpVerification length={OTP_LENGTH} value={otp} onChange={setOtp} onComplete={phoneStep ? verifySignupPhone : verifySignupEmail} status={otpStatus} error={error} onReset={() => { setOtp([]); setError(null); setOtpStatus("input") }} disabled={busy} />
      </motion.div>
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
            expiresAt={otpExpiresAt}
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
          onClick={() => { setPhase("contact"); setError(null); setPassword("") }}
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
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder={t("identifier_placeholder")}
            inputMode="email"
            autoComplete="username"
            aria-label={t("identifier_placeholder")}
            style={{ height: 52, background: "rgba(255,255,255,0.04)", border: `1px solid ${error ? "#f87171" : "rgba(255,255,255,0.14)"}`, borderRadius: 12, padding: "0 16px", color: "#fff", fontSize: 16, outline: "none" }}
          />
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("password_placeholder")}
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
            onClick={() => { setPhase("contact"); setError(null); setPassword("") }}
            data-cms-key="auth.password.switch_to_otp"
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer", textAlign: "center" }}
          >
            {t("switch_to_otp")}
          </button>
        </div>
      </motion.div>
    )
  }

  // ── Contact entry (unified input with auto-detection) ───────────────────────
  if (phase === "contact") {
    const contactType = detectContactType(contact)
    const showFormatHint = contact.trim().length > 0 && contactType === "unknown"

    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease: EASE }}>
        <button
          type="button"
          onClick={() => { setPhase("methods"); setError(null); setOtpStatus("input"); setContact("") }}
          aria-label={t("back")}
          style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", marginBottom: 16, fontSize: 14 }}
        >
          <ChevronLeft size={16} /> {t("back")}
        </button>

        <h2 data-cms-key="auth.contact.title" style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 30, color: "#fff", marginBottom: 6 }}>
          {t("contact_title")}
        </h2>
        <p data-cms-key="auth.contact.subtitle" style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 24 }}>
          {t("contact_subtitle")}
        </p>

        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder={t("contact_placeholder")}
          autoComplete="username"
          aria-label={t("contact_placeholder")}
          style={{
            height: 50,
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${error || showFormatHint ? "#f87171" : "rgba(255,255,255,0.12)"}`,
            borderRadius: 12,
            padding: "0 16px",
            color: "#fff",
            fontSize: 16,
            outline: "none",
            transition: "border-color 0.2s ease",
            width: "100%"
          }}
        />

        {showFormatHint && (
          <p style={{ marginTop: 8, fontSize: 13, color: "#f87171", textAlign: "left" }}>
            {t("contact_format_hint")}
          </p>
        )}

        <button
          type="button"
          onClick={sendContactOtp}
          disabled={busy || contact.trim().length === 0}
          data-cms-key="auth.contact.continue"
          style={{
            marginTop: 12,
            width: "100%",
            height: 50,
            border: "none",
            borderRadius: 9999,
            background: busy || contact.trim().length === 0 ? "rgba(34,197,94,0.5)" : GREEN,
            color: "#000",
            fontWeight: 700,
            fontSize: 16,
            cursor: busy || contact.trim().length === 0 ? "not-allowed" : "pointer",
            transition: "background 0.2s ease"
          }}
        >
          {busy ? t("sending") : t("contact_continue")}
        </button>

        {error && <p data-cms-key="auth.error" style={{ marginTop: 12, fontSize: 13, color: "#f87171", textAlign: "center" }}>{error}</p>}

        <button
          type="button"
          onClick={() => { setPhase("password"); setError(null); setContact("") }}
          data-cms-key="auth.switch_to_password"
          style={{ marginTop: 16, background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 12.5, cursor: "pointer", textAlign: "center", textDecoration: "underline", textUnderlineOffset: 2, textDecorationColor: "rgba(255,255,255,0.1)" }}
        >
          {t("switch_to_password")}
        </button>

        {/* reCAPTCHA compliance notice — only shown on the contact/OTP phase
            where reCAPTCHA is actually executed (sendContactOtp calls grecaptcha.execute).
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
          </a>。
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

        {/* Phone / email sign-in — expands to a tabbed entry */}
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
