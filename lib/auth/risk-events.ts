/**
 * Auth risk event stamping + shared-key grouping.
 *
 * `stampAuthRiskEvent` is called at server-owned auth completions. It stores
 * the client IP and a stable hash of the device fingerprint (User-Agent +
 * Accept-Language). Grouping into `account_flags` happens at read time via
 * `refreshAccountFlags`, so flags stay correct as more stamp points are added
 * without a backfill migration.
 *
 * Must not be called from hot paths — it is one insert per auth event only.
 */

import { createHash } from 'crypto'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { clientIp } from '@/lib/rate-limit'

export type AuthRiskEventType = 'login' | 'otp_verify' | 'signup' | 'admin_login'

export type StampAuthRiskEventInput = {
  userId: string
  req: Request
  eventType?: AuthRiskEventType
}

/**
 * Stable device fingerprint from request headers.
 * Not a real device ID — just enough to spot two accounts on one browser.
 */
export function deviceHashFromRequest(req: Request): string | null {
  const ua = req.headers.get('user-agent')
  const lang = req.headers.get('accept-language')
  if (!ua) return null
  return createHash('sha256').update(`${ua}|${lang ?? ''}`).digest('hex').slice(0, 32)
}

/**
 * Record one auth event. Fire-and-forget safe: failures are logged, never thrown,
 * so a risk-flag outage cannot block a login.
 */
export async function stampAuthRiskEvent(input: StampAuthRiskEventInput): Promise<void> {
  try {
    const service = getLegacyServiceSupabase()
    await service.from('auth_risk_events').insert({
      user_id: input.userId,
      ip: clientIp(input.req) || null,
      device_hash: deviceHashFromRequest(input.req),
      event_type: input.eventType ?? 'login',
    })
  } catch (err) {
    console.warn('[risk-events] stamp_failed', {
      message: err instanceof Error ? err.message : 'unknown',
    })
  }
}

type FlagRow = {
  flag_type: 'shared_ip' | 'shared_device'
  flag_key: string
  member_ids: string[]
  event_count: number
  first_seen: string
  last_seen: string
}

/**
 * Recompute account_flags from auth_risk_events.
 *
 * A key is flagged when ≥2 distinct members have used it. Call this from the
 * admin flags screen (or a cron) — it is a full regroup, not an incremental one.
 */
export async function refreshAccountFlags(): Promise<{ flagged: number } | { error: string }> {
  try {
    const service = getLegacyServiceSupabase()

    // ── Group events by ip / device_hash at read time ──────────────────
    const { data: events, error } = await service
      .from('auth_risk_events')
      .select('user_id, ip, device_hash, created_at')

    if (error) return { error: error.message }

    const buckets = new Map<string, FlagRow>()

    for (const raw of events ?? []) {
      const row = raw as {
        user_id: string | null
        ip: string | null
        device_hash: string | null
        created_at: string | null
      }
      const day = (row.created_at ?? '').slice(0, 10)

      const candidates: Array<{ type: 'shared_ip' | 'shared_device'; key: string | null }> = [
        { type: 'shared_ip', key: row.ip },
        { type: 'shared_device', key: row.device_hash },
      ]

      for (const { type, key } of candidates) {
        if (!key) continue
        const mapKey = `${type}:${key}`
        let bucket = buckets.get(mapKey)
        if (!bucket) {
          bucket = {
            flag_type: type,
            flag_key: key,
            member_ids: [],
            event_count: 0,
            first_seen: day,
            last_seen: day,
          }
          buckets.set(mapKey, bucket)
        }
        if (row.user_id && !bucket.member_ids.includes(row.user_id)) {
          bucket.member_ids.push(row.user_id)
        }
        bucket.event_count += 1
        if (day && (!bucket.first_seen || day < bucket.first_seen)) bucket.first_seen = day
        if (day && (!bucket.last_seen || day > bucket.last_seen)) bucket.last_seen = day
      }
    }

    // ── Keep only genuine shared keys (≥2 distinct members) ───────────
    const flagged = [...buckets.values()].filter((b) => b.member_ids.length >= 2)

    for (const row of flagged) {
      const { error: upsertErr } = await service.from('account_flags').upsert(
        {
          flag_type: row.flag_type,
          flag_key: row.flag_key,
          member_ids: row.member_ids,
          event_count: row.event_count,
          first_seen: row.first_seen || null,
          last_seen: row.last_seen || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'flag_type,flag_key' },
      )
      if (upsertErr) {
        console.warn('[risk-events] flag_upsert_failed', {
          key: row.flag_key,
          message: upsertErr.message,
        })
      }
    }

    return { flagged: flagged.length }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'unknown' }
  }
}
