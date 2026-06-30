"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { AppleLogo } from "@/components/brand"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://248.formhk.com"

/**
 * Sign in with Apple — official HIG button (white variant for contrast on the
 * deep-green auth surface; black glyph + text). Pure redirect OAuth: Supabase
 * holds the Services ID (com.formhk.248snooker.web) and the client-secret JWT,
 * so no client-side Apple env var is needed — this works exactly like the Google
 * redirect fallback. On return, /auth/callback exchanges the code and bounces to
 * returnUrl, where AuthCard's mount-time check resolves the session + profile gate.
 */
export function AppleSignInButton({
  returnUrl,
  label,
  errorLabel,
}: {
  returnUrl: string
  label: string
  errorLabel: string
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const signIn = async () => {
    setBusy(true)
    setErr(null)
    const supabase = createClient()
    const redirectTo = `${SITE_URL}/auth/callback?next=${encodeURIComponent(returnUrl)}`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo },
    })
    if (error) {
      setErr(errorLabel)
      setBusy(false)
    }
    // On success the browser redirects to Apple — nothing more to do here.
  }

  return (
    <div>
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        data-cms-key="auth.apple"
        style={{
          width: "100%",
          minHeight: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          background: "#fff",
          color: "#000",
          border: "none",
          borderRadius: 9999,
          fontWeight: 600,
          fontSize: 16,
          cursor: busy ? "not-allowed" : "pointer",
          opacity: busy ? 0.7 : 1,
        }}
      >
        <AppleLogo size={18} color="#000" />
        {label}
      </button>
      {err && <p style={{ marginTop: 8, fontSize: 13, color: "#f87171", textAlign: "center" }}>{err}</p>}
    </div>
  )
}
