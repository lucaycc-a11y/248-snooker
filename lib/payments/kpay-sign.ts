// ─────────────────────────────────────────────────────────────────
// KPay signature construction and verification (pure functions).
// Merchant mode — no K-App-Id in header or sign text.
// ─────────────────────────────────────────────────────────────────

import crypto from 'node:crypto'

/**
 * Build the sign text for KPay merchant-mode signature.
 *
 * Format (every line ends with \n, including the last):
 *
 *   HTTP請求方法\n
 *   URL\n
 *   請求時間戳\n
 *   請求隨機串\n
 *   商戶編號\n
 *   請求報文主體\n
 *
 * For GET requests the body is an empty string `""`.
 */
export function buildSignText(
  method: string,
  urlPath: string,
  timestamp: string,
  nonceStr: string,
  merchantCode: string,
  body: string,
): string {
  return [method.toUpperCase(), urlPath, timestamp, nonceStr, merchantCode, body]
    .join('\n') + '\n'
}

/**
 * Sign data with the merchant's RSA private key (SHA256 with RSA).
 * Returns a Base64-encoded signature.
 */
export function signKpay(privateKeyPem: string, data: string): string {
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(data, 'utf8')
  signer.end()
  return signer.sign(privateKeyPem, 'base64')
}

/**
 * Verify a KPay signature against the platform public key.
 *
 * @param rawBody - The raw request body (string, not JSON-parsed).
 * @param headers - The KPay headers from the webhook request.
 * @param platformPublicKeyPem - The KPay merchant platform public key (PEM).
 */
export function verifyKpaySignature(
  rawBody: string,
  headers: {
    timestamp: string
    nonceStr: string
    merchantCode: string
    signature: string
  },
  platformPublicKeyPem: string,
): boolean {
  const signText = buildSignText(
    'POST',
    '/api/webhooks/kpay',
    headers.timestamp,
    headers.nonceStr,
    headers.merchantCode,
    rawBody,
  )
  const verifier = crypto.createVerify('RSA-SHA256')
  verifier.update(signText, 'utf8')
  verifier.end()
  return verifier.verify(platformPublicKeyPem, headers.signature, 'base64')
}

/**
 * Generate a 32-byte random nonce string (hex-encoded).
 */
export function generateNonce(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Convert a raw base64-encoded RSA key (without PEM headers) to PEM format.
 * Strips all whitespace from the input before processing.
 */
export function toPem(rawKey: string, type: 'PRIVATE KEY' | 'PUBLIC KEY'): string {
  const cleaned = rawKey.replace(/\s+/g, '')
  const lines = cleaned.match(/.{1,64}/g) || []
  return `-----BEGIN ${type}-----\n${lines.join('\n')}\n-----END ${type}-----\n`
}

/**
 * Generate an RSA key pair for testing purposes.
 * Returns { publicKey, privateKey } in PEM format.
 */
export function generateTestKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  return { publicKey, privateKey }
}