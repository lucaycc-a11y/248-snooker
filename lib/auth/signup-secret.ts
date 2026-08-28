import crypto from 'node:crypto'

const COOKIE_NAME = 'space8_signup_secret'
const MAX_AGE_SECONDS = 15 * 60

type SignupSecret = { signupId: string; password: string }

function encryptionKey(): Buffer {
  const source = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!source) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  return crypto.createHash('sha256').update(source).digest()
}

function encode(value: Buffer): string {
  return value.toString('base64url')
}

function decode(value: string): Buffer {
  return Buffer.from(value, 'base64url')
}

export function encryptSignupSecret(secret: SignupSecret): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(secret), 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return `v1.${encode(iv)}.${encode(tag)}.${encode(ciphertext)}`
}

export function decryptSignupSecret(value: string | null): SignupSecret | null {
  if (!value) return null
  try {
    const [version, ivValue, tagValue, ciphertextValue] = value.split('.')
    if (version !== 'v1' || !ivValue || !tagValue || !ciphertextValue) return null
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), decode(ivValue))
    decipher.setAuthTag(decode(tagValue))
    const plaintext = Buffer.concat([
      decipher.update(decode(ciphertextValue)),
      decipher.final(),
    ]).toString('utf8')
    const parsed: unknown = JSON.parse(plaintext)
    if (!parsed || typeof parsed !== 'object') return null
    const candidate = parsed as { signupId?: unknown; password?: unknown }
    if (typeof candidate.signupId !== 'string' || typeof candidate.password !== 'string') return null
    return { signupId: candidate.signupId, password: candidate.password }
  } catch {
    return null
  }
}

export function setSignupSecretCookie(response: Response, secret: SignupSecret): void {
  response.headers.append(
    'Set-Cookie',
    `${COOKIE_NAME}=${encryptSignupSecret(secret)}; Max-Age=${MAX_AGE_SECONDS}; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
  )
}

export function clearSignupSecretCookie(response: Response): void {
  response.headers.append(
    'Set-Cookie',
    `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
  )
}

export function signupSecretFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  const cookie = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))
  return cookie ? cookie.slice(COOKIE_NAME.length + 1) : null
}
