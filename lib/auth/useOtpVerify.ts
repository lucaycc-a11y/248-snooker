import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { mapSupabaseVerifyError } from "@/lib/auth/otp-errors"

interface OtpVerifyState {
  verifying: boolean
  error: string | null
}

interface OtpVerifyResult {
  ok: boolean
  error?: string
}

export function useOtpVerify(t: (key: string, vars?: Record<string, unknown>) => string) {
  const [state, setState] = useState<OtpVerifyState>({
    verifying: false,
    error: null,
  })

  const verifyPhoneOtp = async (contact: string, otp: string, attemptsLeft: number = 3): Promise<OtpVerifyResult> => {
    setState(prev => ({ ...prev, verifying: true, error: null }))

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.verifyOtp({
        phone: contact,
        token: otp,
        type: "sms",
      })

      if (error) {
        const mappedError = mapSupabaseVerifyError(error, attemptsLeft - 1, t)
        setState(prev => ({
          ...prev,
          verifying: false,
          error: mappedError.message,
        }))
        return { ok: false, error: mappedError.message }
      }

      setState(prev => ({ ...prev, verifying: false }))
      return { ok: true }
    } catch {
      setState(prev => ({ ...prev, verifying: false, error: t("err_network") }))
      return { ok: false, error: t("err_network") }
    }
  }

  const verifyEmailOtp = async (contact: string, otp: string, attemptsLeft: number = 3): Promise<OtpVerifyResult> => {
    setState(prev => ({ ...prev, verifying: true, error: null }))

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.verifyOtp({
        email: contact.trim(),
        token: otp,
        type: "email",
      })

      if (error) {
        const mappedError = mapSupabaseVerifyError(error, attemptsLeft - 1, t)
        setState(prev => ({
          ...prev,
          verifying: false,
          error: mappedError.message,
        }))
        return { ok: false, error: mappedError.message }
      }

      setState(prev => ({ ...prev, verifying: false }))
      return { ok: true }
    } catch {
      setState(prev => ({ ...prev, verifying: false, error: t("err_network") }))
      return { ok: false, error: t("err_network") }
    }
  }

  const clearError = () => {
    setState(prev => ({ ...prev, error: null }))
  }

  return {
    ...state,
    verifyPhoneOtp,
    verifyEmailOtp,
    clearError,
  }
}
