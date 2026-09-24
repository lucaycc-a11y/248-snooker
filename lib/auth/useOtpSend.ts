import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { getRecaptchaToken } from "@/lib/recaptcha"
import { mapSupabaseSendError } from "@/lib/auth/otp-errors"
import { normalizeHkPhone } from "@/lib/auth/profile"

export type OtpChannel = "sms" | "email"
export type OtpDeliveryChannel = "whatsapp" | "sms"

interface OtpSendState {
  busy: boolean
  error: string | null
  cooldown: number
  messageId: string
  otpDeliveryChannel: OtpDeliveryChannel
  otpExpiresAt: string | null
}

interface OtpSendResult {
  ok: boolean
  error?: string
  messageId?: string
  channel?: OtpDeliveryChannel
  expiresAt?: string
}

export function useOtpSend(t: (key: string, vars?: Record<string, unknown>) => string) {
  const [state, setState] = useState<OtpSendState>({
    busy: false,
    error: null,
    cooldown: 0,
    messageId: "",
    otpDeliveryChannel: "sms",
    otpExpiresAt: null,
  })

  const sendPhoneOtp = async (phone: string): Promise<OtpSendResult> => {
    const normalized = normalizeHkPhone(phone)
    if (!normalized) {
      return { ok: false, error: t("err_phone") }
    }

    setState(prev => ({ ...prev, busy: true, error: null }))

    try {
      let recaptchaToken: string
      try {
        recaptchaToken = await getRecaptchaToken("send_otp")
      } catch {
        setState(prev => ({ ...prev, busy: false }))
        return { ok: false, error: t("err_send") }
      }

      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        phone: normalized,
        options: { captchaToken: recaptchaToken },
      })

      if (error) {
        const mappedError = mapSupabaseSendError(error, t)
        setState(prev => ({
          ...prev,
          busy: false,
          error: mappedError.message,
          cooldown: mappedError.retryAfterSeconds ?? 0,
        }))

        // Special case: code already sent (3004) -> still OK to proceed
        if (mappedError.action === "retry" && mappedError.engagelabCode === 3004) {
          const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
          setState(prev => ({ ...prev, otpExpiresAt: expiresAt, otpDeliveryChannel: "sms" }))
          return { ok: true, expiresAt, channel: "sms" }
        }

        return { ok: false, error: mappedError.message }
      }

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
      setState(prev => ({
        ...prev,
        busy: false,
        messageId: "",
        otpExpiresAt: expiresAt,
        otpDeliveryChannel: "sms",
      }))

      return { ok: true, expiresAt, channel: "sms" }
    } catch (e) {
      setState(prev => ({ ...prev, busy: false, error: t("err_network") }))
      return { ok: false, error: t("err_network") }
    }
  }

  const sendEmailOtp = async (email: string): Promise<OtpSendResult> => {
    const trimmed = email.trim()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return { ok: false, error: t("err_email") }
    }

    setState(prev => ({ ...prev, busy: true, error: null }))

    try {
      const res = await fetch("/api/auth/send-email-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      })
      const j = await res.json().catch(() => ({}))

      if (j?.ok !== true) {
        const errorMsg = j?.error === "rate_limited"
          ? t("err_rate_limited")
          : j?.detail
            ? `${t("err_send")} (${j.detail})`
            : t("err_send")
        setState(prev => ({ ...prev, busy: false, error: errorMsg }))
        return { ok: false, error: errorMsg }
      }

      setState(prev => ({ ...prev, busy: false, otpExpiresAt: null }))
      return { ok: true }
    } catch {
      setState(prev => ({ ...prev, busy: false, error: t("err_network") }))
      return { ok: false, error: t("err_network") }
    }
  }

  const setCooldown = (seconds: number) => {
    setState(prev => ({ ...prev, cooldown: seconds }))
  }

  const clearError = () => {
    setState(prev => ({ ...prev, error: null }))
  }

  return {
    ...state,
    sendPhoneOtp,
    sendEmailOtp,
    setCooldown,
    clearError,
  }
}
