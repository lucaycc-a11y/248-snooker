// RSA-SHA256 request signing for KPay, copied from lib/payments/kpay-sign.ts so PaymentX
// stays independent of the live KPay flow.

import crypto from 'node:crypto'

export function buildSignText(
  method: string,
  urlPath: string,
  timestamp: string,
  nonceStr: string,
  merchantCode: string,
  body: string,
): string {
  return [method.toUpperCase(), urlPath, timestamp, nonceStr, merchantCode, body].join('\n') + '\n'
}

export function signText(privateKeyPem: string, data: string): string {
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(data, 'utf8')
  signer.end()
  return signer.sign(privateKeyPem, 'base64')
}

// K-Nonce-Str is documented as String(1,32): 16 random bytes in hex is exactly 32 chars.
export function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex')
}

export function toPem(rawKey: string, type: 'PRIVATE KEY' | 'PUBLIC KEY'): string {
  const cleaned = rawKey.replace(/\s+/g, '')
  const lines = cleaned.match(/.{1,64}/g) || []
  return `-----BEGIN ${type}-----\n${lines.join('\n')}\n-----END ${type}-----\n`
}

export function verifySignature(
  rawBody: string,
  headers: { timestamp: string; nonceStr: string; merchantCode: string; signature: string },
  platformPublicKeyPem: string,
  urlPath: string,
): boolean {
  try {
    const text = buildSignText('POST', urlPath, headers.timestamp, headers.nonceStr, headers.merchantCode, rawBody)
    const verifier = crypto.createVerify('RSA-SHA256')
    verifier.update(text, 'utf8')
    verifier.end()
    return verifier.verify(platformPublicKeyPem, headers.signature, 'base64')
  } catch {
    return false
  }
}
