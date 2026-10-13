import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mocks for the I/O edges so the flow logic can be exercised without Supabase/Resend.
const rateLimitMock = vi.fn<(bucket: string, id: string, max: number, win: number) => Promise<boolean>>()
const generateLinkMock = vi.fn()
const updateUserByIdMock = vi.fn()
const adminSignOutMock = vi.fn()
const verifyOtpMock = vi.fn()
const sendMock = vi.fn()
const tableRows: Record<string, unknown> = {}
const inserts: Array<{ table: string; row: unknown }> = []

function tableBuilder(table: string) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    gte: () => builder,
    limit: () => builder,
    maybeSingle: async () => ({ data: tableRows[table] ?? null, error: null }),
    insert: async (row: unknown) => { inserts.push({ table, row }); return { error: null } },
    upsert: async (row: unknown) => { inserts.push({ table, row }); return { error: null } },
  }
  return builder
}

vi.mock('@/lib/rate-limit', () => ({ rateLimit: (...a: [string, string, number, number]) => rateLimitMock(...a) }))
vi.mock('@/lib/supabase/service', () => ({
  getServiceSupabase: () => ({
    from: tableBuilder,
    rpc: async () => ({ data: tableRows.reserved ?? false, error: null }),
    auth: { admin: { generateLink: generateLinkMock, updateUserById: updateUserByIdMock, signOut: adminSignOutMock } },
  }),
}))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { verifyOtp: verifyOtpMock } }) }))
vi.mock('@/lib/resend/client', () => ({ getResend: () => ({ emails: { send: sendMock } }) }))

import { completePasswordReset, getAppBaseUrl, normalizeEmail, requestPasswordReset } from '../password-reset'

const USER = { id: 'u1', email: 'member@example.com', phone: '', identities: [{ provider: 'email' }] }
const TOKEN = 'a'.repeat(56)

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://uat.space8.com.hk')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon')
  rateLimitMock.mockResolvedValue(true)
  sendMock.mockResolvedValue({ data: { id: 'resend-1' }, error: null })
  for (const k of Object.keys(tableRows)) delete tableRows[k]
  inserts.length = 0
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('normalizeEmail', () => {
  it('trims and lowercases so case variants hit the same account and limiter', () => {
    expect(normalizeEmail('  Member@Example.COM ')).toBe('member@example.com')
  })
  it('rejects non-strings and malformed values', () => {
    expect(normalizeEmail(undefined)).toBeNull()
    expect(normalizeEmail('not-an-email')).toBeNull()
    expect(normalizeEmail(`${'a'.repeat(250)}@x.io`)).toBeNull()
  })
})

describe('getAppBaseUrl', () => {
  it('uses the env origin (UAT and production differ)', () => {
    expect(getAppBaseUrl()).toBe('https://uat.space8.com.hk')
  })
  it('fails closed when unset outside development', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('NODE_ENV', 'production')
    expect(getAppBaseUrl()).toBeNull()
  })
})

describe('requestPasswordReset', () => {
  const req = (email: string) => requestPasswordReset({ email, ip: '1.2.3.4', locale: 'zh-HK' })

  it('emails OUR /reset-password URL with token_hash, never Supabase action_link', async () => {
    tableRows.user_password_status = { password_set: true }
    generateLinkMock.mockResolvedValue({ data: { user: USER, properties: { hashed_token: TOKEN, action_link: 'https://supabase/verify?x' } }, error: null })

    expect(await req('Member@Example.com')).toEqual({ ok: true })
    expect(generateLinkMock).toHaveBeenCalledWith({ type: 'recovery', email: 'member@example.com' })
    const sent = sendMock.mock.calls[0][0] as { html: string; text: string; to: string }
    expect(sent.to).toBe('member@example.com')
    expect(sent.text).toContain(`https://uat.space8.com.hk/reset-password?token_hash=${TOKEN}&type=recovery`)
    expect(sent.html).not.toContain('supabase/verify')
  })

  it('returns the same neutral result for an unknown email and sends nothing', async () => {
    generateLinkMock.mockResolvedValue({ data: null, error: { status: 404, code: 'user_not_found', message: 'User not found' } })
    expect(await req('nobody@example.com')).toEqual({ ok: true })
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('treats soft-deleted accounts as non-existent', async () => {
    tableRows.data_deletion_requests = { id: 'd1' }
    generateLinkMock.mockResolvedValue({ data: { user: USER, properties: { hashed_token: TOKEN } }, error: null })
    expect(await req(USER.email)).toEqual({ ok: true })
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('treats users.is_deleted (Part C) as non-existent — a reset session would restore it', async () => {
    tableRows.users = { is_deleted: true }
    tableRows.user_password_status = { password_set: true }
    generateLinkMock.mockResolvedValue({ data: { user: USER, properties: { hashed_token: TOKEN } }, error: null })
    expect(await req(USER.email)).toEqual({ ok: true })
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('sends the sign-in-method email (no link) to accounts without a password', async () => {
    tableRows.user_password_status = { password_set: false }
    generateLinkMock.mockResolvedValue({ data: { user: { ...USER, identities: [{ provider: 'google' }] }, properties: { hashed_token: TOKEN } }, error: null })
    expect(await req(USER.email)).toEqual({ ok: true })
    const sent = sendMock.mock.calls[0][0] as { html: string; text: string }
    expect(sent.text).toContain('Google')
    expect(sent.text).not.toContain('token_hash')
  })

  it('rolling cooldown: a successful send in the last 60 s → neutral ok, no new token, no email', async () => {
    tableRows.users = { id: 'u1' }
    tableRows.notification_log = { id: 'n1' }
    expect(await req(USER.email)).toEqual({ ok: true })
    expect(generateLinkMock).not.toHaveBeenCalled()
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('enforces the 60 s cooldown before touching Supabase', async () => {
    rateLimitMock.mockImplementation(async (bucket) => bucket !== 'pw_reset_email_cooldown')
    expect(await req(USER.email)).toEqual({ ok: false, error: 'cooldown' })
    expect(generateLinkMock).not.toHaveBeenCalled()
  })

  it('never reports a Resend failure as success, and logs it without the token', async () => {
    tableRows.user_password_status = { password_set: true }
    generateLinkMock.mockResolvedValue({ data: { user: USER, properties: { hashed_token: TOKEN } }, error: null })
    sendMock.mockResolvedValue({ data: null, error: { message: 'domain not verified' } })
    expect(await req(USER.email)).toEqual({ ok: false, error: 'unavailable' })
    const log = inserts.find((i) => i.table === 'notification_log')
    expect(log?.row).toMatchObject({ status: 'failed', type: 'password_reset_link', channel: 'email' })
    expect(JSON.stringify(log?.row)).not.toContain(TOKEN)
  })
})

describe('completePasswordReset', () => {
  const submit = (password: string, confirm = password, tokenHash: string = TOKEN) =>
    completePasswordReset({ tokenHash, password, confirm, ip: '1.2.3.4', locale: 'en' })

  it('rejects a weak password WITHOUT consuming the token', async () => {
    const result = await submit('short')
    expect(result.ok).toBe(false)
    expect(verifyOtpMock).not.toHaveBeenCalled()
  })

  it('rejects mismatched confirmation without consuming the token', async () => {
    expect(await submit('GoodPass123', 'GoodPass124')).toEqual({ ok: false, error: 'password_mismatch' })
    expect(verifyOtpMock).not.toHaveBeenCalled()
  })

  it('maps a used or expired token to link_invalid', async () => {
    verifyOtpMock.mockResolvedValue({ data: { user: null, session: null }, error: { message: 'Email link is invalid or has expired' } })
    expect(await submit('GoodPass123')).toEqual({ ok: false, error: 'link_invalid' })
    expect(updateUserByIdMock).not.toHaveBeenCalled()
  })

  it('updates the password, signs out every session, and sends the notice', async () => {
    verifyOtpMock.mockResolvedValue({ data: { user: USER, session: { access_token: 'at' } }, error: null })
    updateUserByIdMock.mockResolvedValue({ error: null })
    adminSignOutMock.mockResolvedValue({ error: null })

    expect(await submit('GoodPass123')).toEqual({ ok: true })
    expect(updateUserByIdMock).toHaveBeenCalledWith('u1', { password: 'GoodPass123' })
    expect(adminSignOutMock).toHaveBeenCalledWith('at', 'global')
    const notice = sendMock.mock.calls[0][0] as { subject: string; text: string }
    expect(notice.subject).toBe('Your Space8 password was changed')
    expect(notice.text).toContain('wa.me/85261808022')
    expect(notice.text).not.toContain('GoodPass123')
  })
})
