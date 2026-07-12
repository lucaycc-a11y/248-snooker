import crypto from 'node:crypto'

// Site-gate password hashing. Node-only (scrypt) — used from API routes that
// declare `export const runtime = 'nodejs'`, never from middleware (Edge
// runtime has no node:crypto). Follows the same "no extra deps" approach as
// lib/qr/jwt.ts, using Node's built-in scrypt instead of bcrypt/argon2.

const KEY_LEN = 64

function scrypt(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LEN, (err, derivedKey) => {
      if (err) reject(err)
      else resolve(derivedKey)
    })
  })
}

/** Generate a random gate password (human-typeable) + its salt/hash to store. */
export async function generateGatePassword(): Promise<{
  password: string
  salt: string
  hash: string
}> {
  // 10 unambiguous chars — long enough to resist guessing, short enough to type.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.randomBytes(10)
  const password = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')

  const salt = crypto.randomBytes(16).toString('hex')
  const hash = (await scrypt(password, salt)).toString('hex')
  return { password, salt, hash }
}

/** Verify a candidate password against the stored salt/hash, timing-safe. */
export async function verifyGatePassword(
  candidate: string,
  salt: string,
  expectedHash: string,
): Promise<boolean> {
  const candidateHash = await scrypt(candidate, salt)
  const expectedBuf = Buffer.from(expectedHash, 'hex')
  if (candidateHash.length !== expectedBuf.length) return false
  return crypto.timingSafeEqual(candidateHash, expectedBuf)
}
