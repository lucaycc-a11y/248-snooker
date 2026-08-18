import { getResend } from './client'
import { getServiceSupabase } from '@/lib/supabase/service'
import { getTableName } from '@/lib/booking/constants'
import { humanReadableCode } from '@/lib/qr/jwt'
import QRCode from 'qrcode'
import { getStripe } from '@/lib/stripe/server'
import { bookingConfirmationTemplate } from './templates/booking-confirmation'
import { bookingReminderTemplate } from './templates/booking-reminder'
import { SITE_CONTACT } from '@/lib/site/contact'

/* ── Constants ────────────────────────────────────────────────────────────── */

const VENUE_ADDRESS = 'Room 05, 3/F, Tai Lik Industrial Centre, 32 Tai Yau Street, San Po Kong, Hong Kong'
const GOOGLE_MAPS_URL = 'https://www.google.com/maps/search/?api=1&query=Tai+Lik+Industrial+Centre+32+Tai+Yau+Street+San+Po+Kong+Hong+Kong'
const WHATSAPP_FALLBACK = SITE_CONTACT.phoneDigits

/**
 * Human-readable labels for payment_method values.
 * For `card` payments, the last 4 digits are appended dynamically.
 */
const PAYMENT_METHOD_LABELS: Record<string, { en: string; zh: string }> = {
  alipay_hk:  { en: 'AlipayHK',   zh: '支付寶香港 AlipayHK' },
  apple_pay:  { en: 'Apple Pay',  zh: 'Apple Pay' },
  google_pay: { en: 'Google Pay', zh: 'Google Pay' },
  card:       { en: 'Card',       zh: '信用卡' },
  wechat_pay: { en: 'WeChat Pay', zh: '微信支付 WeChat Pay' },
  free:       { en: 'Free (Test)',zh: '內部測試' },
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

/**
 * Format a date string (YYYY-MM-DD) into a human-readable format with locale.
 * e.g. "2026年7月30日 (週三)" or "Thursday, July 30, 2026"
 */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00+08:00')
  const zhDay = ['日', '一', '二', '三', '四', '五', '六']
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (週${zhDay[d.getDay()]})`
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
    const supabase = getServiceSupabase()
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

/* ── Template rendering ───────────────────────────────────────────────────── */

/**
 * Load an HTML template from the compiled template string and substitute {{variable}} placeholders.
 * No runtime file I/O — the template is a TypeScript string constant compiled at build time.
 */
function renderTemplate(templateName: string, replacements: Record<string, string>): string {
  const templates: Record<string, string> = {
    'booking-confirmation.html': bookingConfirmationTemplate,
    'booking-reminder.html': bookingReminderTemplate,
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
}> {
  const supabase = getServiceSupabase()

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

  // Payment method with last 4 digits if applicable
  const paymentMethodDisplay = await formatPaymentMethod(
    booking.payment_method,
    booking.stripe_payment_intent,
  )

  // QR code image — upload to Supabase Storage for reliable HTTPS URL
  const qrContent = booking.qr_code ?? booking.human_code ?? humanReadableCode(bookingId)
  if (!qrContent) {
    throw new Error(`missing_qr_content: booking ${bookingId} has no qr_code, human_code, or derivable code`)
  }

  let qrCodeUrl: string
  try {
    // Generate QR as PNG buffer
    const qrBuffer = await QRCode.toBuffer(qrContent, {
      errorCorrectionLevel: 'M',
      type: 'png',
      width: 500,
      margin: 4,
      color: { dark: '#000000', light: '#FFFFFF' },
    })

    // Upload to Supabase Storage (public bucket)
    const qrFileName = `booking-${bookingId}.png`
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('qr-codes')
      .upload(qrFileName, qrBuffer, {
        contentType: 'image/png',
        upsert: true,
      })

    if (uploadError) {
      throw uploadError
    }

    const { data: publicUrlData } = supabase
      .storage
      .from('qr-codes')
      .getPublicUrl(qrFileName)

    qrCodeUrl = publicUrlData.publicUrl
  } catch (qrErr) {
    // Fallback to base64 data URL if storage upload fails
    console.warn('[template-send] QR upload failed, falling back to base64', { bookingId, error: (qrErr as Error).message })
    qrCodeUrl = await QRCode.toDataURL(qrContent, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 500,
      margin: 4,
      color: { dark: '#000000', light: '#FFFFFF' },
    })
  }

  // Booking detail URL — link to member dashboard
  const bookingDetailUrl = `https://space8.com.hk/member`

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
    '{{qrCodeUrl}}': qrCodeUrl,
    '{{totalPrice}}': String(totalPrice),
    '{{paymentMethod}}': paymentMethodDisplay,
    '{{pointsEarned}}': String(pointsEarned),
    '{{whatsappNumber}}': whatsappNumber,
    '{{bookingDetailUrl}}': bookingDetailUrl,
    '{{venueAddress}}': VENUE_ADDRESS,
    '{{googleMapsUrl}}': GOOGLE_MAPS_URL,
    '{{currentYear}}': currentYear,
  })

  const subject = `預約確認 · Space8 · ${bookingDate} ${startTime}–${endTime}`

  return { html, subject, to: customerEmail, locale }
}

export async function sendBookingConfirmation(bookingId: string): Promise<void> {
  const { html, subject, to } = await renderBookingConfirmationHtml(bookingId)

  if (!to) {
    console.warn('[template-send] no recipient email, skipping send', { bookingId })
    return
  }

  const resend = getResend()
  const supabase = getServiceSupabase()

  await resend.emails.send({
    from: 'SPACE8 <no-reply@space8.com.hk>',
    to,
    subject,
    html,
  })

  // Stamp sent time — non-fatal
  await supabase
    .from('bookings')
    .update({ confirmation_email_sent_at: new Date().toISOString() })
    .eq('id', bookingId)

  console.log('[template-send] booking confirmation email sent', { bookingId, to })
}

/* ── Reminder Email ───────────────────────────────────────────────────────── */

async function renderBookingReminderHtml(bookingId: string): Promise<{
  html: string
  subject: string
  to: string
}> {
  const supabase = getServiceSupabase()

  // ── Fetch booking ──────────────────────────────────────────────────────────
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select('id, user_id, date, start_time, end_time, duration_hours, table_number, human_code, booking_reference, qr_code, status')
    .eq('id', bookingId)
    .single()

  if (bookingErr || !booking) {
    throw new Error(`Failed to fetch booking ${bookingId}: ${bookingErr?.message ?? 'not found'}`)
  }

  // ── Fetch user ─────────────────────────────────────────────────────────────
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('id, display_name, email, phone')
    .eq('id', booking.user_id)
    .single()

  if (userErr || !user) {
    throw new Error(`Failed to fetch user for booking ${bookingId}: ${userErr?.message ?? 'not found'}`)
  }

  // ── Derive values ──────────────────────────────────────────────────────────
  const customerName = user.display_name ?? user.phone ?? ''
  const customerEmail = user.email ?? ''
  const locale = 'zh-HK'

  const venueDisplayName = getTableName(booking.table_number, locale)
  const bookingDate = formatDate(booking.date)
  const startTime = formatTime(booking.start_time)
  const endTime = formatTime(booking.end_time)
  const durationHours = Number(booking.duration_hours)

  // QR code image — upload to Supabase Storage for reliable HTTPS URL
  const qrContent = booking.qr_code ?? booking.human_code ?? humanReadableCode(bookingId)
  if (!qrContent) {
    throw new Error(`missing_qr_content: booking ${bookingId} has no qr_code, human_code, or derivable code`)
  }

  let qrCodeUrl: string
  try {
    const qrBuffer = await QRCode.toBuffer(qrContent, {
      errorCorrectionLevel: 'M',
      type: 'png',
      width: 500,
      margin: 4,
      color: { dark: '#000000', light: '#FFFFFF' },
    })

    const qrFileName = `booking-${bookingId}.png`
    const { error: uploadError } = await supabase
      .storage
      .from('qr-codes')
      .upload(qrFileName, qrBuffer, {
        contentType: 'image/png',
        upsert: true,
      })

    if (uploadError) throw uploadError

    const { data: publicUrlData } = supabase
      .storage
      .from('qr-codes')
      .getPublicUrl(qrFileName)

    qrCodeUrl = publicUrlData.publicUrl
  } catch (qrErr) {
    console.warn('[template-send] QR upload failed for reminder, falling back to base64', { bookingId, error: (qrErr as Error).message })
    qrCodeUrl = await QRCode.toDataURL(qrContent, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 500,
      margin: 4,
      color: { dark: '#000000', light: '#FFFFFF' },
    })
  }

  const whatsappNumber = await getWhatsAppNumber()
  const currentYear = String(new Date().getFullYear())

  // ── Load template and substitute ───────────────────────────────────────────
  const html = renderTemplate('booking-reminder.html', {
    '{{customerName}}': customerName,
    '{{customerEmail}}': customerEmail,
    '{{venueDisplayName}}': venueDisplayName,
    '{{bookingDate}}': bookingDate,
    '{{startTime}}': startTime,
    '{{endTime}}': endTime,
    '{{durationHours}}': String(durationHours),
    '{{bookingReference}}': booking.booking_reference ?? '',
    '{{humanCode}}': booking.human_code ?? '',
    '{{qrCodeUrl}}': qrCodeUrl,
    '{{whatsappNumber}}': whatsappNumber,
    '{{venueAddress}}': VENUE_ADDRESS,
    '{{googleMapsUrl}}': GOOGLE_MAPS_URL,
    '{{currentYear}}': currentYear,
  })

  const subject = `⏰ 準備入場 Ready to Play · ${bookingDate} ${startTime}–${endTime}`

  return { html, subject, to: customerEmail }
}

export async function sendBookingReminder(bookingId: string): Promise<void> {
  const { html, subject, to } = await renderBookingReminderHtml(bookingId)

  if (!to) {
    console.warn('[template-send] no recipient email for reminder, skipping', { bookingId })
    return
  }

  const resend = getResend()
  const supabase = getServiceSupabase()

  await resend.emails.send({
    from: 'SPACE8 <no-reply@space8.com.hk>',
    to,
    subject,
    html,
  })

  // Stamp sent time — non-fatal
  await supabase
    .from('bookings')
    .update({ reminder_email_sent_at: new Date().toISOString() })
    .eq('id', bookingId)

  console.log('[template-send] booking reminder email sent', { bookingId, to })
}