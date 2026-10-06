import { getResend } from './client'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { getTableName } from '@/lib/booking/constants'
import { humanReadableCode } from '@/lib/qr/jwt'
import QRCode from 'qrcode'
import { getStripe } from '@/lib/stripe/server'
import {
  bookingConfirmationTemplate,
  bookingConfirmationQrImageHtml,
  bookingConfirmationQrUnavailableHtml,
} from './templates/booking-confirmation'
import { SITE_CONTACT } from '@/lib/site/contact'

/* ── Constants ────────────────────────────────────────────────────────────── */

const VENUE_ADDRESS = 'Room 05, 3/f, Laurels Industrial Centre, Tai Yau Street 32, San Po Kong, Hong Kong'
const GOOGLE_MAPS_URL = 'https://www.google.com/maps/search/?api=1&query=Tai+Lik+Industrial+Centre+32+Tai+Yau+Street+San+Po+Kong+Hong+Kong'
const WHATSAPP_FALLBACK = SITE_CONTACT.phoneDigits
const QR_CONTENT_ID = 'space8-entry-qr'
/** Rendered at 240px in the email; 480px keeps it sharp on 2x displays. */
const QR_PNG_WIDTH = 480

type InlineAttachment = {
  filename: string
  content: Buffer
  contentType: string
  inlineContentId: string
}

/**
 * Human-readable labels for payment_method values.
 * For `card` payments, the last 4 digits are appended dynamically.
 */
const PAYMENT_METHOD_LABELS: Record<string, { en: string; zh: string }> = {
  card:        { en: 'Credit Card',  zh: '信用卡' },
  fps:         { en: 'FPS',          zh: 'FPS 轉數快' },
  payme:       { en: 'PayMe',        zh: 'PayMe' },
  octopus:     { en: 'Octopus',      zh: '八達通' },
  alipay:      { en: 'Alipay',       zh: '支付寶' },
  alipayhk:    { en: 'AlipayHK',     zh: '支付寶香港' },
  alipay_hk:   { en: 'AlipayHK',     zh: '支付寶香港' },
  wechat:      { en: 'WeChat Pay',   zh: '微信支付' },
  wechat_pay:  { en: 'WeChat Pay',   zh: '微信支付' },
  unionpay_qp: { en: 'UnionPay QR',  zh: '雲閃付' },
  apple_pay:   { en: 'Apple Pay',    zh: 'Apple Pay' },
  google_pay:  { en: 'Google Pay',   zh: 'Google Pay' },
  free:        { en: 'Free (Test)',  zh: '內部測試' },
  test:        { en: 'Test',         zh: '測試' },
}

const PAYMENT_METHOD_ICONS: Record<string, string> = {
  card:        'https://space8.com.hk/icons/payment/cnp-visa.png',
  fps:         'https://space8.com.hk/icons/payment/fps.png',
  payme:       'https://space8.com.hk/icons/payment/payme.png',
  octopus:     'https://space8.com.hk/icons/payment/octopus-card.png',
  alipay:      'https://space8.com.hk/icons/payment/alipaycn.png',
  alipayhk:    'https://space8.com.hk/icons/payment/alipayhk.png',
  alipay_hk:   'https://space8.com.hk/icons/payment/alipayhk.png',
  wechat:      'https://space8.com.hk/icons/payment/wechat.png',
  wechat_pay:  'https://space8.com.hk/icons/payment/wechat.png',
  unionpay_qp: 'https://space8.com.hk/icons/payment/cnp-unionpay.png',
  apple_pay:   'https://space8.com.hk/icons/payment/apple.png',
  google_pay:  'https://space8.com.hk/icons/payment/google.png',
}

function getPaymentMethodIconUrl(method: string | null): string {
  return PAYMENT_METHOD_ICONS[method ?? ''] ?? ''
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

/**
 * Format a date string (YYYY-MM-DD) into a human-readable format with locale.
 * e.g. "2026年7月30日 (週三)" or "Thursday, July 30, 2026"
 *
 * Directly parses the date string without timezone conversion to avoid
 * off-by-one errors when server timezone (UTC) differs from HK timezone (+08:00).
 */
function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const zhDay = ['日', '一', '二', '三', '四', '五', '六']
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return `${year}年${month}月${day}日 (週${zhDay[weekday]})`
}

function formatTime(time: string): string {
  return time.slice(0, 5)
}

/**
 * Derive a human-readable payment method string.
 * For card payments, tries to fetch the last 4 digits from Stripe.
 */
async function formatPaymentMethod(
  paymentMethod: string | null,
  stripePaymentIntent: string | null,
): Promise<string> {
  const label = PAYMENT_METHOD_LABELS[paymentMethod ?? '']
  if (!label) return paymentMethod ?? '—'

  // For card payments, try to get the last 4 digits from Stripe
  if (paymentMethod === 'card' && stripePaymentIntent) {
    try {
      const stripe = getStripe()
      const pi = await stripe.paymentIntents.retrieve(stripePaymentIntent)
      if (typeof pi.latest_charge === 'string') {
        const charge = await stripe.charges.retrieve(pi.latest_charge)
        const last4 = charge.payment_method_details?.card?.last4
        if (last4) {
          return `${label.zh} (尾號 ${last4})`
        }
      }
    } catch {
      // non-fatal — fall back to label without last4
    }
  }

  return label.zh
}

/**
 * Load the venue's WhatsApp number from bot_config, with a hardcoded fallback.
 */
async function getWhatsAppNumber(): Promise<string> {
  try {
    const supabase = getLegacyServiceSupabase()
    const { data: config } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'admin_phones')
      .single()
    if (config?.value && Array.isArray(config.value) && config.value.length > 0) {
      return String(config.value[0])
    }
  } catch {
    // non-fatal
  }
  return WHATSAPP_FALLBACK
}

/** Record a QR failure in notification_log — non-fatal, never blocks the send. */
async function logQrFailure(userId: string, bookingId: string, errorMessage: string): Promise<void> {
  try {
    const supabase = getLegacyServiceSupabase()
    const { error } = await supabase.from('notification_log').insert({
      user_id: userId,
      booking_id: bookingId,
      channel: 'email',
      type: 'booking_confirmed_qr',
      status: 'failed',
      error_message: errorMessage.slice(0, 500),
    })
    if (error) console.error('[template-send] notification_log insert failed', { bookingId, error: error.message })
  } catch (e) {
    console.error('[template-send] notification_log insert threw', { bookingId, error: e instanceof Error ? e.message : String(e) })
  }
}

/* ── Template rendering ───────────────────────────────────────────────────── */

/**
 * Load an HTML template from the compiled template string and substitute {{variable}} placeholders.
 * No runtime file I/O — the template is a TypeScript string constant compiled at build time.
 */
function renderTemplate(templateName: string, replacements: Record<string, string>): string {
  const templates: Record<string, string> = {
    'booking-confirmation.html': bookingConfirmationTemplate,
  }

  let html = templates[templateName]
  if (!html) {
    throw new Error(`Unknown template: ${templateName}`)
  }

  for (const [key, value] of Object.entries(replacements)) {
    html = html.replaceAll(key, value)
  }

  // Warn about unsubstituted variables
  const unsubstituted = html.match(/\{\{.+?\}\}/g)
  if (unsubstituted && unsubstituted.length > 0) {
    console.warn(`[template-send] unsubstituted variables in ${templateName}:`, unsubstituted)
  }

  return html
}

/* ── Confirmation Email ───────────────────────────────────────────────────── */

async function renderBookingConfirmationHtml(bookingId: string): Promise<{
  html: string
  subject: string
  to: string
  locale: string
  attachments: InlineAttachment[]
  userId: string
}> {
  const supabase = getLegacyServiceSupabase()

  // ── Fetch booking ──────────────────────────────────────────────────────────
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select('id, user_id, date, start_time, end_time, duration_hours, total_price, table_number, payment_method, human_code, booking_reference, qr_code, status, stripe_payment_intent')
    .eq('id', bookingId)
    .single()

  if (bookingErr || !booking) {
    throw new Error(`Failed to fetch booking ${bookingId}: ${bookingErr?.message ?? 'not found'}`)
  }

  // ── Fetch user ─────────────────────────────────────────────────────────────
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('id, display_name, email, phone, member_code')
    .eq('id', booking.user_id)
    .single()

  if (userErr || !user) {
    throw new Error(`Failed to fetch user for booking ${bookingId}: ${userErr?.message ?? 'not found'}`)
  }

  // ── Fetch points earned ────────────────────────────────────────────────────
  const { data: pointsRow } = await supabase
    .from('points_ledger')
    .select('points')
    .eq('reference_id', bookingId)
    .eq('type', 'booking')
    .maybeSingle()

  const pointsEarned = pointsRow?.points ?? 0

  // ── Derive values ──────────────────────────────────────────────────────────
  const customerName = user.display_name ?? user.phone ?? ''
  const customerEmail = user.email ?? ''
  const locale = 'zh-HK' // default locale for email

  // Room name using the shared getTableName helper
  const venueDisplayName = getTableName(booking.table_number, locale)

  const bookingDate = formatDate(booking.date)
  const startTime = formatTime(booking.start_time)
  const endTime = formatTime(booking.end_time)
  const durationHours = Number(booking.duration_hours)
  const totalPrice = booking.total_price

  const paymentMethodDisplay = await formatPaymentMethod(
    booking.payment_method,
    booking.stripe_payment_intent,
  )
  const paymentMethodIconUrl = getPaymentMethodIconUrl(booking.payment_method)
  const paymentMethodIconHtml = paymentMethodIconUrl
    ? `<img src="${paymentMethodIconUrl}" alt="${paymentMethodDisplay}" width="32" height="32" style="display:inline-block;vertical-align:middle;margin-right:8px;border-radius:4px;" />`
    : ''

  // QR code image — encodes the user's member_code so every QR is the universal
  // member identifier, not a booking-specific code (same value as the member card QR).
  const qrContent = user.member_code
  if (!qrContent) {
    throw new Error(`missing_member_code: user ${booking.user_id} has no member_code`)
  }

  // PNG sent as an inline (cid:) attachment. Gmail strips data: URIs and inline SVG,
  // and the payload must never appear in a public URL. On failure the email still
  // sends with a text fallback instead of a broken <img>, and the error is logged.
  let attachments: InlineAttachment[] = []
  let qrImageHtml: string
  try {
    const png = await QRCode.toBuffer(qrContent, {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 4,
      width: QR_PNG_WIDTH,
      color: { dark: '#000000', light: '#ffffff' },
    })
    attachments = [{
      filename: 'space8-entry-qr.png',
      content: png,
      contentType: 'image/png',
      inlineContentId: QR_CONTENT_ID,
    }]
    qrImageHtml = bookingConfirmationQrImageHtml(QR_CONTENT_ID)
  } catch (qrErr) {
    const message = qrErr instanceof Error ? qrErr.message : String(qrErr)
    console.error('[template-send] QR PNG generation failed, sending without QR', { bookingId, error: message })
    await logQrFailure(booking.user_id, bookingId, `qr_generation_failed: ${message}`)
    qrImageHtml = bookingConfirmationQrUnavailableHtml
  }

  // Booking detail URL — link to member dashboard
  const bookingDetailUrl = `https://space8.com.hk/member`

  // Member access deep-link — open the access guide tab directly.
  const memberEntryUrl = `https://space8.com.hk/member?tab=access`

  // WhatsApp number
  const whatsappNumber = await getWhatsAppNumber()

  // Current year
  const currentYear = String(new Date().getFullYear())

  // ── Load template and substitute ───────────────────────────────────────────
  const html = renderTemplate('booking-confirmation.html', {
    '{{customerName}}': customerName,
    '{{customerEmail}}': customerEmail,
    '{{venueDisplayName}}': venueDisplayName,
    '{{bookingDate}}': bookingDate,
    '{{startTime}}': startTime,
    '{{endTime}}': endTime,
    '{{durationHours}}': String(durationHours),
    '{{bookingReference}}': booking.booking_reference ?? '',
    '{{humanCode}}': booking.human_code ?? '',
    '{{qrImageHtml}}': qrImageHtml,
    '{{totalPrice}}': String(totalPrice),
    '{{paymentMethod}}': paymentMethodDisplay,
    '{{paymentMethodIconHtml}}': paymentMethodIconHtml,
    '{{pointsEarned}}': String(pointsEarned),
    '{{whatsappNumber}}': whatsappNumber,
    '{{bookingDetailUrl}}': bookingDetailUrl,
    '{{memberEntryUrl}}': memberEntryUrl,
    '{{venueAddress}}': VENUE_ADDRESS,
    '{{googleMapsUrl}}': GOOGLE_MAPS_URL,
    '{{currentYear}}': currentYear,
  })

  const subject = `預約確認 · Space8 · ${bookingDate} ${startTime}–${endTime}`

  return { html, subject, to: customerEmail, locale, attachments, userId: booking.user_id }
}

export async function sendBookingConfirmation(bookingId: string): Promise<{ emailId: string | null }> {
  const rendered = await renderBookingConfirmationHtml(bookingId)
  const { subject, to, userId } = rendered
  let { html, attachments } = rendered

  if (!to) {
    console.warn('[template-send] no recipient email, skipping send', { bookingId })
    return { emailId: null }
  }

  const resend = getResend()
  const supabase = getLegacyServiceSupabase()
  const from = 'SPACE8 <no-reply@space8.com.hk>'

  let result = await resend.emails.send({ from, to, subject, html, attachments })

  // If Resend rejected the request while an attachment was present, retry once
  // without it (and without the cid: image) so the confirmation still arrives.
  if (result.error && attachments.length > 0) {
    const firstError = result.error.message
    console.error('[template-send] send with QR attachment failed, retrying without QR', { bookingId, error: firstError })
    await logQrFailure(userId, bookingId, `qr_attachment_failed: ${firstError}`)
    html = html.replace(bookingConfirmationQrImageHtml(QR_CONTENT_ID), bookingConfirmationQrUnavailableHtml)
    attachments = []
    result = await resend.emails.send({ from, to, subject, html })
  }

  if (result.error) {
    // Throw so callers' existing catch blocks log it instead of recording "sent".
    throw new Error(`resend_send_failed: ${result.error.message}`)
  }

  // Stamp sent time — non-fatal
  await supabase
    .from('bookings')
    .update({ confirmation_email_sent_at: new Date().toISOString() })
    .eq('id', bookingId)

  const emailId = result.data?.id ?? null
  console.log('[template-send] booking confirmation email sent', { bookingId, to, emailId, qrAttached: attachments.length > 0 })
  return { emailId }
}
