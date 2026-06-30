"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://248.formhk.com"
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

// Official Google 4-color "G" — used only by the fallback button (the GIS path
// renders Google's own button markup). Not a generic mono "G".
function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

/**
 * Renders Google's OFFICIAL Identity Services button when NEXT_PUBLIC_GOOGLE_CLIENT_ID
 * is configured (no-redirect: credential → supabase.signInWithIdToken → onSignedIn).
 * Otherwise falls back to a Google-branded button that uses the working redirect
 * OAuth flow (→ /auth/callback). Never dead code; degrades gracefully.
 */
export function GoogleSignInButton({
  returnUrl,
  onSignedIn,
  fallbackLabel,
  errorLabel,
}: {
  returnUrl: string
  // Called after an in-place (no-redirect) GIS sign-in succeeds.
  onSignedIn: () => void
  fallbackLabel: string
  errorLabel: string
}) {
  const gisRef = useRef<HTMLDivElement>(null)
  const [gisReady, setGisReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // GIS path: load the script + render the official button.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    let cancelled = false

    const init = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const google = (window as any).google
      if (!google?.accounts?.id || !gisRef.current || cancelled) return
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (resp: { credential: string }) => {
          setBusy(true)
          setErr(null)
          const supabase = createClient()
          const { error } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token: resp.credential,
          })
          if (error) {
            setErr(errorLabel)
            setBusy(false)
            return
          }
          onSignedIn()
        },
      })
      google.accounts.id.renderButton(gisRef.current, {
        theme: "filled_black",
        size: "large",
        shape: "pill",
        text: "continue_with",
        width: 320,
      })
      setGisReady(true)
    }

    const existing = document.getElementById("google-gis")
    if (existing) {
      init()
    } else {
      const s = document.createElement("script")
      s.src = "https://accounts.google.com/gsi/client"
      s.async = true
      s.defer = true
      s.id = "google-gis"
      s.onload = init
      document.body.appendChild(s)
    }
    return () => {
      cancelled = true
    }
  }, [onSignedIn, errorLabel])

  // Fallback: redirect OAuth (the existing, known-working path).
  const fallbackSignIn = async () => {
    setBusy(true)
    setErr(null)
    const supabase = createClient()
    const redirectTo = `${SITE_URL}/auth/callback?next=${encodeURIComponent(returnUrl)}`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    })
    if (error) {
      setErr(errorLabel)
      setBusy(false)
    }
  }

  return (
    <div>
      {GOOGLE_CLIENT_ID ? (
        <div ref={gisRef} style={{ display: "flex", justifyContent: "center", minHeight: 44 }} />
      ) : null}

      {/* Fallback button shown when GIS isn't configured or hasn't rendered yet. */}
      {(!GOOGLE_CLIENT_ID || !gisReady) && (
        <button
          type="button"
          onClick={fallbackSignIn}
          disabled={busy}
          data-cms-key="auth.google"
          style={{
            width: "100%",
            minHeight: 52,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            background: "#fff",
            color: "#1a1a1a",
            border: "none",
            borderRadius: 9999,
            fontWeight: 600,
            fontSize: 16,
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.7 : 1,
          }}
        >
          <GoogleG />
          {fallbackLabel}
        </button>
      )}

      {err && <p style={{ marginTop: 8, fontSize: 13, color: "#f87171", textAlign: "center" }}>{err}</p>}
    </div>
  )
}
