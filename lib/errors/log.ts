import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

export type ErrorSeverity = 'error' | 'warning' | 'info'

// Persists a row to site_error_log for the Admin App's 網站狀態 tab and its
// realtime/push pipeline. Never throws — a logging failure must not mask or
// replace the original error being logged, so failures here are swallowed
// after a console.error. Awaited by callers (not fire-and-forget) since Vercel
// can freeze a Node function as soon as the response is returned, which would
// drop an un-awaited insert.
export async function logSiteError(
  source: string,
  severity: ErrorSeverity,
  message: string,
  detail?: Record<string, unknown>,
): Promise<void> {
  try {
    const supabase = getLegacyServiceSupabase()
    const { error } = await supabase.from('site_error_log').insert({
      source,
      severity,
      message,
      detail: detail ?? null,
    })
    if (error) {
      console.error('[errors/log] site_error_log_insert_failed', { message: error.message })
    }
    // Payment-pipeline errors email the owner straight away (no polling job). Awaited for the
    // same reason as the insert above; it never throws.
    if (!error && severity === 'error') {
      const { PAYMENT_ALERT_SOURCES, alertPaymentProblemNow } = await import('@/lib/admin/paymentAlertNow')
      if (PAYMENT_ALERT_SOURCES.has(source)) await alertPaymentProblemNow({ source, message, detail })
    }
  } catch (e) {
    console.error('[errors/log] site_error_log_insert_failed', { message: (e as Error).message })
  }
}
