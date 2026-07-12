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

/** Hash an admin-chosen gate password with a freshly generated salt. */
export async function hashGatePassword(password: string): Promise<{ salt: string; hash: string }> {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = (await scrypt(password, salt)).toString('hex')
  return { salt, hash }
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
