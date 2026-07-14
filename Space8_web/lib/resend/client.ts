import { Resend } from 'resend'

let resendClient: Resend | null = null

export function getResend(): Resend {
  if (resendClient) return resendClient

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set')
  }

  resendClient = new Resend(apiKey)
  return resendClient
}
