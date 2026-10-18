/**
 * Typed Google Ads (gtag.js) helpers.
 *
 * The base tag lives in components/analytics/google-tag.tsx. This module is
 * only for firing conversion events from client code after a real business
 * outcome — never from a button click that can still fail payment.
 */

/** gtag() is a queue-backed stub until googletagmanager.com loads. */
type GTagCall = (
  command: string,
  targetOrParams: string | Date | Record<string, unknown>,
  params?: Record<string, unknown>,
) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GTagCall;
  }
}

/**
 * Google Ads conversion label, format `AW-XXXXXXXXXX/xxxxxxxx`.
 * Unset means "not configured yet" — track*() no-ops rather than sending a
 * malformed event that would show up as an unattributed hit in Ads.
 */
function resolveLabel(): string | null {
  const label = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL;
  return typeof label === "string" && label.length > 0 ? label : null;
}

export type BookingConversion = {
  /**
   * bookings.id. Google Ads dedupes conversions by `transaction_id`, so a
   * refresh on the confirmation screen cannot double-count the same booking.
   */
  transactionId: string;
  /**
   * Net amount charged in HKD — `bookings.total_price`, the post-discount
   * figure the charge and receipt are read from. Not `base_price`.
   */
  value: number;
};

/**
 * Report a completed booking as a Google Ads conversion.
 *
 * No-ops when the label is unset or gtag has not loaded. Both are normal:
 * the label is added per-environment, and the queue may not have hydrated yet
 * on a very fast navigation. `transaction_id` covers the retry case.
 */
export function trackBookingConversion({
  transactionId,
  value,
}: BookingConversion): void {
  if (typeof window === "undefined") return;

  const sendTo = resolveLabel();
  if (!sendTo) return;
  if (typeof window.gtag !== "function") return;

  window.gtag("event", "conversion", {
    send_to: sendTo,
    value,
    currency: "HKD",
    transaction_id: transactionId,
  });
}
