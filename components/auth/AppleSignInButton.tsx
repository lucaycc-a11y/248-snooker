"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { AppleLogo } from "@/components/brand"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://248.formhk.com"
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
// Services ID (also configured in Supabase Auth → Providers → Apple).
const APPLE_CLIENT_ID = "com.formhk.248snooker.web"
const APPLE_SDK_SRC =
  "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js"

// Apple's web JS SDK redirects to / posts back from a URL that MUST be registered
// in the Apple Services ID. The registered Return URL is the Supabase callback,
// so the popup points there; we derive it from the public Supabase URL.
const APPLE_REDIRECT_URI = SUPABASE_URL
  ? `${SUPABASE_URL}/auth/v1/callback`
  : `${SITE_URL}/auth/callback`

// Minimal typing for the injected global.
interface AppleIDAuth {
  init(config: { clientId: string; scope: string; redirectURI: string; usePopup: boolean; nonce?: string }): void
  signIn(opts?: { nonce?: string }): Promise<{ authorization?: { id_token?: string; code?: string } }>
}
declare global {
  interface Window {
    AppleID?: { auth: AppleIDAuth }
  }
}

function randomNonce(): string {
  // 32 hex chars of CSPRNG entropy; raw (un-hashed) value is passed to BOTH Apple
  // and Supabase. Apple's WEB JS SDK embeds the raw nonce in the id_token (it does
  // not SHA-256 it — that requirement is native-only), so raw-to-both verifies.
  const a = new Uint8Array(16)
  crypto.getRandomValues(a)
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Sign in with Apple — official Apple JS SDK popup flow (no full-page redirect):
 *   AppleID.auth.signIn({ nonce }) → supabase.auth.signInWithIdToken({ provider:
 *   'apple', token, nonce }) → onSignedIn() (in-place, AuthCard resolves the gate).
 *
 * Falls back automatically to Supabase redirect OAuth when the SDK can't load or
 * the popup errors for any reason other than user-cancel — so this is never a
 * dead path. Official HIG button (white variant for the dark surface).
 *
 * NOTE for live verification: the popup redirectURI (APPLE_REDIRECT_URI) must be
 * one of the Return URLs registered in the Apple Services ID. If a popup attempt
 * errors with invalid_redirect / invalid_request, register that exact URL in
 * Apple Developer → Services ID, or rely on the redirect fallback (which uses the
 * Supabase callback Supabase itself manages).
 */
export function AppleSignInButton({
  returnUrl,
  onSignedIn,
  label,
  errorLabel,
}: {
  returnUrl: string
  onSignedIn: () => void
  label: string
  errorLabel: string
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const sdkReady = useRef(false)

  // Load + init the Apple JS SDK (popup mode).
  useEffect(() => {
    let cancelled = false
    const init = () => {
      if (cancelled || !window.AppleID) return
      try {
        window.AppleID.auth.init({
          clientId: APPLE_CLIENT_ID,
          scope: "name email",
          redirectURI: APPLE_REDIRECT_URI,
          usePopup: true,
        })
        sdkReady.current = true
      } catch {
        sdkReady.current = false // → click uses the redirect fallback
      }
    }
    if (document.getElementById("apple-sdk")) {
      init()
    } else {
      const s = document.createElement("script")
      s.src = APPLE_SDK_SRC
      s.id = "apple-sdk"
      s.async = true
      s.onload = init
      s.onerror = () => {
        sdkReady.current = false
      }
      document.body.appendChild(s)
    }
    return () => {
      cancelled = true
    }
  }, [])

  // Fallback: Supabase redirect OAuth (uses the Supabase-managed Apple callback;
  // needs no client-side Apple env var). Known-good path.
  const redirectSignIn = async () => {
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
    // success → browser redirects to Apple.
  }

  const handleClick = async () => {
    if (!sdkReady.current || !window.AppleID) {
      return redirectSignIn()
    }
    setBusy(true)
    setErr(null)
    const nonce = randomNonce()
    try {
      const data = await window.AppleID.auth.signIn({ nonce })
      const idToken = data?.authorization?.id_token
      if (!idToken) throw new Error("no_id_token")
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: idToken,
        nonce,
      })
      if (error) throw error
      onSignedIn() // in-place sign-in succeeded
    } catch (e: unknown) {
      const code = (e as { error?: string })?.error
      // User dismissed the Apple popup — not an error, just reset.
      if (code === "popup_closed_by_user" || code === "user_cancelled_authorize" || code === "user_trigger_new_signin_flow") {
        setBusy(false)
        return
      }
      // Any real popup/token failure → fall back to the known-good redirect flow.
      await redirectSignIn()
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
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
