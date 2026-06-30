"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { AppleLogo } from "@/components/brand"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://248.formhk.com"

/**
 * Sign in with Apple — Supabase redirect OAuth, mirroring the WORKING Google flow
 * (confirmed creating real auth.users). No Apple JS SDK / popup.
 *
 * Why redirect, not the popup SDK: the popup flow hit a 403 at Apple's own
 * /appleauth/auth/oauth/authorize endpoint — Apple rejecting the authorize request
 * itself (Services-ID domain/redirect mismatch, strict in popup mode), before
 * Supabase was ever reached. In redirect mode SUPABASE constructs the authorize
 * request server-side using the Services ID + client-secret JWT IT holds, so:
 *   - no client_id is sent from the browser (kills any stale/cached-id concern),
 *   - the redirect_uri is Supabase's own callback (already the registered Return
 *     URL), so the params match what Apple expects by construction.
 *
 * Flow: signInWithOAuth({ provider:'apple' }) → Apple → Supabase callback →
 * /auth/callback?next=<returnUrl> (same path Google uses) → AuthCard resolves the
 * session + profile gate on return.
 */
export function AppleSignInButton({
  returnUrl,
  label,
  errorLabel,
}: {
  returnUrl: string
  onSignedIn?: () => void
  label: string
  errorLabel: string
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const signIn = async () => {
    setBusy(true)
    setErr(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(returnUrl)}` },
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
