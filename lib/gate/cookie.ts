// Signs/verifies the site-gate bypass cookie using Web Crypto (crypto.subtle),
// not node:crypto — this runs inside middleware.ts, which executes on the Edge
// runtime and has no access to Node's crypto module. HMAC-SHA256 over a
// `${issuedAt}:${passwordVersion}` payload, base64url + timing-safe-compare.
//
// Cookie format: `${issuedAt}.${passwordVersion}.${signature}` (3 parts).
// Old two-part cookies (pre-password-version) are rejected outright because
// parts.length !== 3. To invalidate ALL current sessions in an emergency,
// rotate GATE_COOKIE_SECRET in the environment (no UI needed).

export const GATE_COOKIE_NAME = 'site_gate_bypass'

// Default lifetime: 1 hour. UAT builds may override via GATE_COOKIE_MAX_AGE_SECONDS,
// but production always uses the 3 600-second default regardless of that env var.
function maxAgeSeconds(): number {
  if (process.env.NEXT_PUBLIC_APP_ENV === 'production') return 3600
  const override = parseInt(process.env.GATE_COOKIE_MAX_AGE_SECONDS ?? '', 10)
  return Number.isFinite(override) && override > 0 ? override : 3600
}

function base64url(bytes: ArrayBuffer): string {
  return Buffer.from(bytes).toString('base64url')
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

/** The string that is actually signed: covers both fields so neither can be tampered. */
function signingPayload(issuedAt: number, passwordVersion: number): string {
  return `${issuedAt}:${passwordVersion}`
}

/** Sign a bypass cookie value: `${issuedAt}.${passwordVersion}.${signature}`. */
export async function signGateCookie(secret: string, passwordVersion: number): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000)
  const key = await hmacKey(secret)
  const payload = signingPayload(issuedAt, passwordVersion)
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return `${issuedAt}.${passwordVersion}.${base64url(signature)}`
}

/**
 * Verify a bypass cookie: checks signature, expiry, and password version.
 * Returns false (not an error) for any malformed, expired, or version-mismatched cookie —
 * the caller should treat false as "gate not bypassed" and redirect as usual.
 */
export async function verifyGateCookie(
  value: string,
  secret: string,
  currentPasswordVersion: number,
): Promise<boolean> {
  const parts = value.split('.')
  // Three-part format required; old two-part cookies are rejected here.
  if (parts.length !== 3) return false

  const [issuedAtStr, pwVersionStr, sig] = parts
  const issuedAt = Number(issuedAtStr)
  const pwVersion = Number(pwVersionStr)
  if (!Number.isFinite(issuedAt) || !Number.isFinite(pwVersion)) return false

  // Expiry check
  if (Math.floor(Date.now() / 1000) - issuedAt > maxAgeSeconds()) return false

  // Password version check — rejects any cookie issued before the last password change
  if (pwVersion !== currentPasswordVersion) return false

  // Signature check
  const key = await hmacKey(secret)
  const payload = signingPayload(issuedAt, pwVersion)
  const expectedSig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const expected = base64url(expectedSig)

  if (sig.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < sig.length; i++) {
    diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}
