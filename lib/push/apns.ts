import crypto from 'node:crypto'
import http2 from 'node:http2'

// Minimal APNs HTTP/2 client (token auth, ES256 JWT) — no extra dependencies.
// Env: APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY_P8 (contents of the .p8; "\n" escapes
// are accepted; base64 of the .p8 also works), APNS_BUNDLE_ID. When any is missing, sending is a logged no-op.

export type ApnsEnvironment = 'production' | 'sandbox'

export type ApnsPayload = {
  title: string
  body: string
  /** Custom keys delivered next to `aps` (deep-link info, ids). */
  data?: Record<string, string>
  badge?: number
  threadId?: string
}

export type ApnsResult =
  | { ok: true }
  | { ok: false; status: number; reason: string; invalidToken: boolean }

type Config = { keyId: string; teamId: string; key: string; bundleId: string }

function config(): Config | null {
  const keyId = process.env.APNS_KEY_ID?.trim()
  const teamId = process.env.APNS_TEAM_ID?.trim()
  const rawKey = process.env.APNS_KEY_P8
  const bundleId = process.env.APNS_BUNDLE_ID?.trim()
  if (!keyId || !teamId || !rawKey || !bundleId) return null
  // Accept the raw .p8 text (with real or "\n"-escaped newlines) or the same base64 form the
  // Supabase edge function uses, so one value can be copied between the two.
  const trimmed = rawKey.trim()
  const key = trimmed.includes('BEGIN')
    ? trimmed.replace(/\\n/g, '\n')
    : Buffer.from(trimmed, 'base64').toString('utf8')
  return { keyId, teamId, key, bundleId }
}

export function apnsConfigured(): boolean {
  return config() !== null
}

let jwtCache: { token: string; issuedAt: number } | null = null

function providerToken(cfg: Config): string {
  const now = Math.floor(Date.now() / 1000)
  // Apple wants a refresh between 20 and 60 minutes.
  if (jwtCache && now - jwtCache.issuedAt < 40 * 60) return jwtCache.token
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url')
  const unsigned = `${b64({ alg: 'ES256', kid: cfg.keyId })}.${b64({ iss: cfg.teamId, iat: now })}`
  const signature = crypto
    .sign('sha256', Buffer.from(unsigned), { key: cfg.key, dsaEncoding: 'ieee-p1363' })
    .toString('base64url')
  const token = `${unsigned}.${signature}`
  jwtCache = { token, issuedAt: now }
  return token
}

const HOSTS: Record<ApnsEnvironment, string> = {
  production: 'https://api.push.apple.com',
  sandbox: 'https://api.sandbox.push.apple.com',
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

export async function sendApns(
  deviceToken: string,
  env: ApnsEnvironment,
  payload: ApnsPayload,
): Promise<ApnsResult> {
  const cfg = config()
  if (!cfg) return { ok: false, status: 0, reason: 'apns_not_configured', invalidToken: false }

  const body = JSON.stringify({
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: 'default',
      ...(payload.badge !== undefined ? { badge: payload.badge } : {}),
      ...(payload.threadId ? { 'thread-id': payload.threadId } : {}),
    },
    ...(payload.data ?? {}),
  })

  return new Promise<ApnsResult>((resolve) => {
    const client = http2.connect(HOSTS[env])
    let settled = false
    const done = (r: ApnsResult) => {
      if (settled) return
      settled = true
      client.close()
      resolve(r)
    }
    client.on('error', (err) => done({ ok: false, status: 0, reason: err.message, invalidToken: false }))

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      authorization: `bearer ${providerToken(cfg)}`,
      'apns-topic': cfg.bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    })
    req.setTimeout(8000, () => {
      req.close()
      done({ ok: false, status: 0, reason: 'timeout', invalidToken: false })
    })

    let status = 0
    let text = ''
    req.on('response', (h) => {
      status = Number(h[':status'] ?? 0)
    })
    req.setEncoding('utf8')
    req.on('data', (c: string) => {
      text += c
    })
    req.on('end', () => {
      if (status === 200) return done({ ok: true })
      let reason = `http_${status}`
      try {
        const parsed: unknown = JSON.parse(text)
        if (isRecord(parsed) && typeof parsed.reason === 'string') reason = parsed.reason
      } catch {
        /* keep default reason */
      }
      done({
        ok: false,
        status,
        reason,
        invalidToken: status === 410 || reason === 'BadDeviceToken' || reason === 'Unregistered',
      })
    })
    req.on('error', (err) => done({ ok: false, status: 0, reason: err.message, invalidToken: false }))
    req.end(body)
  })
}
