// Signs/verifies the site-gate bypass cookie using Web Crypto (crypto.subtle),
// not node:crypto — this runs inside middleware.ts, which executes on the Edge
// runtime and has no access to Node's crypto module. HMAC-SHA256 over a
// `${issuedAt}` payload, same base64url + timing-safe-compare shape as
// lib/qr/jwt.ts, just built on SubtleCrypto instead.

export const GATE_COOKIE_NAME = 'site_gate_bypass'
const MAX_AGE_SECONDS = 60 * 60 // 1 hour — deliberately short so the password must be re-entered often

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

/** Sign a bypass cookie value: `${issuedAtEpochSeconds}.${signature}`. */
export async function signGateCookie(secret: string): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000)
  const key = await hmacKey(secret)
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(String(issuedAt)))
  return `${issuedAt}.${base64url(signature)}`
}

/** Verify a bypass cookie value's signature and expiry (7-day max age). */
export async function verifyGateCookie(value: string, secret: string): Promise<boolean> {
  const parts = value.split('.')
  if (parts.length !== 2) return false
  const [issuedAtStr, sig] = parts
  const issuedAt = Number(issuedAtStr)
  if (!Number.isFinite(issuedAt)) return false
  if (Math.floor(Date.now() / 1000) - issuedAt > MAX_AGE_SECONDS) return false

  const key = await hmacKey(secret)
  const expectedSig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(issuedAtStr))
  const expected = base64url(expectedSig)

  // Constant-time-ish comparison: lengths must match, then compare byte buffers.
  if (sig.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < sig.length; i++) {
    diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}
