import { getServiceSupabase } from './supabase/service'

// Thin wrapper over the check_rate_limit() RPC (see migration 0003). Returns true
// if the request is ALLOWED, false if the caller is over the limit for this window.
//
//   bucket         route family, e.g. 'booking_quote' | 'payment_intent' | 'auth'
//   identifier     'user:<uuid>' or 'ip:<addr>'
//   max            max requests per window
//   windowSeconds  window length (e.g. 60)
//
// Fail-OPEN: if the limiter itself errors (RPC/network outage), we allow the
// request and log it, rather than blocking paying users on infrastructure
// hiccups. Abuse protection should not become a self-inflicted outage. If you'd
// rather fail closed on the payment route specifically, branch on `bucket`.
export async function rateLimit(
  bucket: string,
  identifier: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const supabase = getServiceSupabase()
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_bucket: bucket,
      p_identifier: identifier,
      p_max: max,
      p_window_seconds: windowSeconds,
    })
    if (error) {
      console.error('rate_limit_rpc_error', error.message)
      return true // fail open
    }
    return data === true
  } catch (err) {
    console.error('rate_limit_error', (err as Error).message)
    return true // fail open
  }
}

/** Extract the best-effort client IP from a request's forwarding headers. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}
