import crypto from 'node:crypto'
import { describe, it, expect } from 'vitest'

import {
  buildSignText,
  signKpay,
  verifyKpaySignature,
  generateTestKeyPair,
  generateNonce,
} from './kpay-sign'

// ── buildSignText ──────────────────────────────────────────────

describe('buildSignText', () => {
  it('assembles the correct sign text format with trailing newline', () => {
    const text = buildSignText(
      'POST',
      '/v1/order/add',
      '1723800000000',
      'abc123def456ghi789jkl012mno345pqr',
      '852999500001',
      '{"outTradeNo":"SPACE8-ABC12"}',
    )
    const expected = [
      'POST',
      '/v1/order/add',
      '1723800000000',
      'abc123def456ghi789jkl012mno345pqr',
      '852999500001',
      '{"outTradeNo":"SPACE8-ABC12"}',
      '', // trailing \n
    ].join('\n')
    expect(text).toBe(expected)
  })

  it('handles empty body for GET requests', () => {
    const text = buildSignText('GET', '/v1/order/sales/result?outTradeNo=TEST', '1723800000000', 'nonce123', 'MERCH1', '')
    const lines = text.split('\n')
    expect(lines[0]).toBe('GET')
    expect(lines[1]).toBe('/v1/order/sales/result?outTradeNo=TEST')
    expect(lines[5]).toBe('')
    expect(text.endsWith('\n')).toBe(true)
  })

  it('converts method to uppercase', () => {
    const text = buildSignText('post', '/v1/order/add', '0', 'nonce', 'MERCH', '{}')
    expect(text.startsWith('POST\n')).toBe(true)
  })

  it('preserves query string in URL path', () => {
    const text = buildSignText('GET', '/v1/order/sales/result?outTradeNo=TEST', '0', 'nonce', 'MERCH', '')
    expect(text.split('\n')[1]).toBe('/v1/order/sales/result?outTradeNo=TEST')
  })
})

// ── signKpay / verifyKpaySignature round-trip ──────────────────

describe('signKpay + verifyKpaySignature round-trip', () => {
  it('signs and verifies correctly with a generated key pair', () => {
    const { publicKey, privateKey } = generateTestKeyPair()
    const data = 'POST\n/v1/order/add\n1723800000000\nnonce123\nMERCHANT1\n{"test":true}\n'
    const signature = signKpay(privateKey, data)
    expect(signature).toBeTruthy()
    expect(typeof signature).toBe('string')

    const verifier = crypto.createVerify('RSA-SHA256')
    verifier.update(data, 'utf8')
    verifier.end()
    const isValid = verifier.verify(publicKey, signature, 'base64')
    expect(isValid).toBe(true)
  })

  it('rejects a signature signed with a different key', () => {
    const { privateKey: key1 } = generateTestKeyPair()
    const { publicKey: pub2 } = generateTestKeyPair()
    const data = 'POST\n/v1/test\n0\nnonce\nMERCH\n{}\n'
    const signature = signKpay(key1, data)

    const verifier = crypto.createVerify('RSA-SHA256')
    verifier.update(data, 'utf8')
    verifier.end()
    const isValid = verifier.verify(pub2, signature, 'base64')
    expect(isValid).toBe(false)
  })

  it('rejects tampered data', () => {
    const { publicKey, privateKey } = generateTestKeyPair()
    const data = 'POST\n/v1/order/add\n1723800000000\nnonce123\nMERCHANT1\n{"test":true}\n'
    const signature = signKpay(privateKey, data)

    const tampered = 'POST\n/v1/order/add\n1723800000000\nnonce123\nMERCHANT1\n{"test":false}\n'
    const verifier = crypto.createVerify('RSA-SHA256')
    verifier.update(tampered, 'utf8')
    verifier.end()
    const isValid = verifier.verify(publicKey, signature, 'base64')
    expect(isValid).toBe(false)
  })
})

// ── verifyKpaySignature (full webhook path) ────────────────────

describe('verifyKpaySignature (webhook)', () => {
  it('verifies a webhook payload correctly', () => {
    const { publicKey, privateKey } = generateTestKeyPair()
    const rawBody = '{"orderNo":"KPAY123","outTradeNo":"SPACE8-ABC12","status":"SUCCESS"}'
    const timestamp = '1723800000000'
    const nonceStr = generateNonce()
    const merchantCode = 'MERCHANT1'

    // Build the sign text the same way the webhook handler would
    const signText = buildSignText('POST', '/api/webhooks/kpay', timestamp, nonceStr, merchantCode, rawBody)
    const signature = signKpay(privateKey, signText)

    const isValid = verifyKpaySignature(rawBody, {
      timestamp,
      nonceStr,
      merchantCode,
      signature,
    }, publicKey)

    expect(isValid).toBe(true)
  })

  it('rejects webhook with wrong signature', () => {
    const { publicKey } = generateTestKeyPair()
    const { privateKey: wrongKey } = generateTestKeyPair()
    const rawBody = '{"orderNo":"KPAY123"}'
    const timestamp = '1723800000000'
    const nonceStr = generateNonce()
    const merchantCode = 'MERCHANT1'

    const signText = buildSignText('POST', '/api/webhooks/kpay', timestamp, nonceStr, merchantCode, rawBody)
    const signature = signKpay(wrongKey, signText)

    const isValid = verifyKpaySignature(rawBody, {
      timestamp,
      nonceStr,
      merchantCode,
      signature,
    }, publicKey)

    expect(isValid).toBe(false)
  })
})

// ── generateNonce ──────────────────────────────────────────────

describe('generateNonce', () => {
  it('produces a 64-character hex string (32 bytes)', () => {
    const nonce = generateNonce()
    expect(nonce).toHaveLength(64)
  })

  it('produces unique values on successive calls', () => {
    const a = generateNonce()
    const b = generateNonce()
    expect(a).not.toBe(b)
  })
})