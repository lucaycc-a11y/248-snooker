import crypto from 'node:crypto'

// QR access token + human-readable companion code.
//
// The QR is a compact HS256 JWT signed with QR_SECRET, verifiable OFFLINE by the
// ESP32 door controller (it holds a synced copy of QR_SECRET — no network call at
// the door). We sign with Node's built-in crypto rather than pulling in
// jsonwebtoken, keeping zero extra dependencies.

export type QrPayload = {
  booking_id: string
  user_id: string
  table_number: number
  start_time: string // ISO 8601
  end_time: string // ISO 8601
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

/**
 * Sign a QR access token. exp = start_time + 5 minutes (the entry window): the
 * code is only valid from the booking start until 5 minutes in.
 */
export function signQrToken(payload: QrPayload): string {
  const secret = process.env.QR_SECRET
  if (!secret) throw new Error('QR_SECRET is not set')

  const header = { alg: 'HS256', typ: 'JWT' }
  const exp = Math.floor(new Date(payload.start_time).getTime() / 1000) + 5 * 60
  const claims = { ...payload, exp }

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`
  const signature = crypto.createHmac('sha256', secret).update(signingInput).digest('base64url')
  return `${signingInput}.${signature}`
}

/**
 * Verify a QR token's signature and expiry. Returns the decoded claims, or null
 * if the signature is invalid or the token has expired. Uses a timing-safe
 * comparison so an attacker can't probe the signature byte by byte.
 */
export function verifyQrToken(token: string): (QrPayload & { exp: number }) | null {
  const secret = process.env.QR_SECRET
  if (!secret) return null

  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [h, p, sig] = parts

  const expected = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url')
  const sigBuf = Buffer.from(sig)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null
  }

  try {
    const claims = JSON.parse(Buffer.from(p, 'base64url').toString()) as QrPayload & { exp: number }
    if (typeof claims.exp === 'number' && claims.exp < Math.floor(Date.now() / 1000)) {
      return null // expired
    }
    return claims
  } catch {
    return null
  }
}

// Unambiguous alphabet (no 0/O/1/I) for codes humans read aloud / type.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Luhn-style mod-100 check digits over the alphabet positions — catches typos
 * when staff key a code in manually. Not cryptographic; the JWT is the real auth. */
function checkDigits(s: string): string {
  let sum = 0
  for (let i = 0; i < s.length; i++) {
    let v = ALPHABET.indexOf(s[i])
    if (v < 0) v = 0
    if (i % 2 === 0) v *= 2
    sum += v
  }
  return String(sum % 100).padStart(2, '0')
}

/**
 * Deterministic human-readable companion code: 248-XXXXXXXX-XXXX-CC
 * (8 chars, 4 chars, 2 check digits). Derived from the booking id so it's stable
 * and reproducible for staff/manual fallback at the door.
 */
export function humanReadableCode(bookingId: string): string {
  const h = crypto.createHash('sha256').update(bookingId).digest()
  const pick = (start: number, len: number) =>
    Array.from({ length: len }, (_, i) => ALPHABET[h[start + i] % ALPHABET.length]).join('')
  const p1 = pick(0, 8)
  const p2 = pick(8, 4)
  return `248-${p1}-${p2}-${checkDigits(p1 + p2)}`
}
