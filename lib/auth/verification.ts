import crypto from 'node:crypto'
import { getResend } from '@/lib/resend/client'

export const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000

export type VerificationCode = {
  code: string
  hash: string
  expiresAt: string
}

export function createVerificationCode(): VerificationCode {
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
  return {
    code,
    hash: hashVerificationCode(code),
    expiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS).toISOString(),
  }
}

export function hashVerificationCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim()).digest('hex')
}

export function isVerificationCodeValid(
  code: string,
  expectedHash: string | null,
  expiresAt: string | null,
): boolean {
  if (!expectedHash || !expiresAt || new Date(expiresAt).getTime() <= Date.now()) return false
  const actual = Buffer.from(hashVerificationCode(code), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}

export async function sendEmailVerificationCode(params: {
  to: string
  code: string
  purpose: 'signup' | 'contact-change'
}): Promise<void> {
  const purposeText = params.purpose === 'signup' ? 'verify your Space8 account' : 'confirm your Space8 contact change'
  const resend = getResend()
  await resend.emails.send({
    from: 'Space8 <no-reply@space8.com.hk>',
    to: params.to,
    subject: params.purpose === 'signup' ? 'Your Space8 verification code' : 'Confirm your Space8 contact change',
    text: `Use ${params.code} to ${purposeText}. This code expires in 10 minutes.`,
  })
}
