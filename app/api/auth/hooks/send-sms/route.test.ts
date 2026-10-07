import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Webhook } from 'standardwebhooks'
import { NextRequest } from 'next/server'

const sendMock = vi.fn()
vi.mock('@/lib/engagelab/send-hook', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/engagelab/send-hook')>()
  return { ...actual, sendSupabaseOtpViaEngagelab: (...args: unknown[]) => sendMock(...args) }
})

import { POST } from './route'

// Test-only secret (random bytes, base64), in Supabase's "v1,whsec_" format.
const RAW_SECRET = Buffer.from('space8-test-secret-0123456789abcdef').toString('base64')
const HOOK_SECRET = `v1,whsec_${RAW_SECRET}`
const PHONE = '+85290000123'
const OTP = '482913'

function signedRequest(body: unknown, secret = RAW_SECRET): NextRequest {
  const raw = JSON.stringify(body)
  const id = 'msg_test'
  const ts = new Date()
  const signature = new Webhook(secret).sign(id, ts, raw)
  return new NextRequest('http://localhost/api/auth/hooks/send-sms', {
    method: 'POST',
    body: raw,
    headers: {
      'webhook-id': id,
      'webhook-timestamp': String(Math.floor(ts.getTime() / 1000)),
      'webhook-signature': signature,
    },
  })
}

type ConsoleSpy = { mock: { calls: unknown[][] }; mockRestore: () => void }

function allLogOutput(spies: ConsoleSpy[]): string {
  return spies.flatMap((s) => s.mock.calls.map((c) => c.map(String).join(' '))).join('\n')
}

describe('send-sms hook route', () => {
  let spies: ConsoleSpy[]

  beforeEach(() => {
    process.env.SUPABASE_AUTH_HOOK_SECRET = HOOK_SECRET
    sendMock.mockReset()
    sendMock.mockResolvedValue({ message_id: 'm1', send_channel: 'sms' })
    spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    )
  })

  afterEach(() => {
    spies.forEach((s) => s.mockRestore())
  })

  it('sends to user.phone (phone signup/login)', async () => {
    const res = await POST(signedRequest({ user: { id: 'u1', phone: PHONE }, sms: { otp: OTP } }))
    expect(res.status).toBe(200)
    expect(sendMock).toHaveBeenCalledWith(PHONE, OTP, 'zh_HK')
  })

  it('sends to user.phone_change when user.phone is empty', async () => {
    const res = await POST(
      signedRequest({ user: { id: 'u1', phone: '', phone_change: PHONE }, sms: { otp: OTP } }),
    )
    expect(res.status).toBe(200)
    expect(sendMock).toHaveBeenCalledWith(PHONE, OTP, 'zh_HK')
  })

  it('sends to user.new_phone (GoTrue JSON name for phone_change)', async () => {
    const res = await POST(
      signedRequest({ user: { id: 'u1', email: 'a@example.com', new_phone: PHONE }, sms: { otp: OTP } }),
    )
    expect(res.status).toBe(200)
    expect(sendMock).toHaveBeenCalledWith(PHONE, OTP, 'zh_HK')
  })

  it('prefers sms.phone, which GoTrue sets for every flow', async () => {
    const res = await POST(
      signedRequest({ user: { id: 'u1', email: 'a@example.com' }, sms: { otp: OTP, phone: PHONE } }),
    )
    expect(res.status).toBe(200)
    expect(sendMock).toHaveBeenCalledWith(PHONE, OTP, 'zh_HK')
  })

  it('returns 400 when phone is missing and logs key names only', async () => {
    const res = await POST(
      signedRequest({ user: { id: 'u1', email: 'secret@example.com' }, sms: { otp: OTP } }),
    )
    expect(res.status).toBe(400)
    expect(sendMock).not.toHaveBeenCalled()
    const out = allLogOutput(spies)
    expect(out).toContain('send_sms_hook.missing_fields')
    expect(out).toContain('"userKeys":["id","email"]')
    expect(out).not.toContain(OTP)
    expect(out).not.toContain('secret@example.com')
  })

  it('returns 401 on an invalid signature', async () => {
    const wrong = Buffer.from('a-different-secret-entirely-xyz').toString('base64')
    const res = await POST(signedRequest({ user: { phone: PHONE }, sms: { otp: OTP } }, wrong))
    expect(res.status).toBe(401)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('never logs the OTP or the full phone on success or failure', async () => {
    await POST(signedRequest({ user: { id: 'u1', phone: PHONE }, sms: { otp: OTP } }))
    sendMock.mockRejectedValueOnce({ code: 3001, message: 'fail' })
    await POST(signedRequest({ user: { id: 'u1', phone: PHONE }, sms: { otp: OTP } }))
    const out = allLogOutput(spies)
    expect(out).not.toContain(OTP)
    expect(out).not.toContain(PHONE)
    expect(out).not.toContain('90000123')
    expect(out).toContain('*****123')
  })
})

// Extract each console.*( ... ) call up to its balanced closing paren.
function consoleCalls(src: string): string[] {
  const out: string[] = []
  const re = /console\.\w+\(/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    let depth = 1
    let i = m.index + m[0].length
    while (i < src.length && depth > 0) {
      if (src[i] === '(') depth++
      else if (src[i] === ')') depth--
      i++
    }
    out.push(src.slice(m.index, i))
  }
  return out
}

describe('OTP logging guard (source)', () => {
  const files = ['lib/engagelab/send-hook.ts', 'app/api/auth/hooks/send-sms/route.ts']

  for (const f of files) {
    it(`${f} never passes otpCode, sms.otp, otp or the request body to console`, () => {
      const src = readFileSync(join(process.cwd(), f), 'utf8')
      const calls = consoleCalls(src)
      if (f.endsWith('route.ts')) expect(calls.length).toBeGreaterThan(0)
      for (const raw of calls) {
        // `!!otp` logs a boolean, which is fine; anything else naming the code is not.
        const call = raw.replace(/!!\s*[\w?.]+/g, '')
        expect(call).not.toMatch(/otpCode|sms\??\.otp|\botp\b|requestBody|rawBody|rawText/)
      }
    })
  }
})
