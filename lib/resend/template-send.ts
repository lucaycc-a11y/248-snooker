import { getResend } from './client'
import { getServiceSupabase } from '@/lib/supabase/service'
import { getTableName } from '@/lib/booking/constants'
import { humanReadableCode } from '@/lib/qr/jwt'
import QRCode from 'qrcode'
import { getStripe } from '@/lib/stripe/server'
import { bookingConfirmationTemplate } from './templates/booking-confirmation'
import { SITE_CONTACT } from '@/lib/site/contact'

/* ── Constants ────────────────────────────────────────────────────────────── */

const VENUE_ADDRESS = 'Room 05, 3/f, Laurels Industrial Centre, Tai Yau Street 32, San Po Kong, Hong Kong'
const GOOGLE_MAPS_URL = 'https://www.google.com/maps/search/?api=1&query=Tai+Lik+Industrial+Centre+32+Tai+Yau+Street+San+Po+Kong+Hong+Kong'
const WHATSAPP_FALLBACK = SITE_CONTACT.phoneDigits

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

  const paymentMethodDisplay = await formatPaymentMethod(
    booking.payment_method,
    booking.stripe_payment_intent,
  )
  const paymentMethodIconUrl = getPaymentMethodIconUrl(booking.payment_method)
  const paymentMethodIconHtml = paymentMethodIconUrl
    ? `<img src="${paymentMethodIconUrl}" alt="${paymentMethodDisplay}" width="32" height="32" style="display:inline-block;vertical-align:middle;margin-right:8px;border-radius:4px;" />`
    : ''

  // QR code image — encodes the user's member_code so every QR is the universal
  // member identifier, not a booking-specific code.
  const qrContent = user.member_code
  if (!qrContent) {
    throw new Error(`missing_member_code: user ${booking.user_id} has no member_code`)
  }

  let qrCodeUrl: string
  try {
    // Generate QR as SVG with SPACE8 logo embedded
    const svg = await QRCode.toString(qrContent, {
      type: 'svg',
      margin: 2,
      errorCorrectionLevel: 'H', // High error correction needed for logo overlay
      color: { dark: '#0a0a0a', light: '#ffffff' },
      width: 500,
    })

    // Embed SPACE8 logo in the center with white backing.
    // Logo is inlined as a base64 data URI — an external href would not resolve
    // when the outer SVG is itself embedded as a data:image/svg+xml;base64,… URL.
    const logoDataUri =
      'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyBpZD0iTGF5ZXJfMSIgZGF0YS1uYW1lPSJMYXllciAxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAwIDEwMDAiPgogIDxkZWZzPgogICAgPHN0eWxlPgogICAgICAuY2xzLTEgewogICAgICAgIGZpbGw6ICNmZmY7CiAgICAgIH0KICAgIDwvc3R5bGU+CiAgPC9kZWZzPgogIDxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTM5MS4zMSw3ODYuMTFjLTk0LjExLDAtMTU1LjA4LTY4LjQ4LTE1NS4wOC0xNzMuMTYsMC02Ni45LDMxLjgxLTExMi41NSw3NS41NS0xMjkuMDgtMzUuNzktMTMuMzgtNjYuMjctNDkuNTktNjYuMjctMTIyLDAtOTcuNiw2MS42My0xNDcuOTcsMTU1LjA4LTE0Ny45N2gxOTguODFjOTMuNDQsMCwxNTUuNzQsNTAuMzcsMTU1Ljc0LDE0Ny45NywwLDcyLjQxLTMxLjE1LDEwOC42Mi02Ni45MywxMjIsNDMuNzQsMTYuNTMsNzUuNTUsNjIuMTgsNzUuNTUsMTI5LjA4LDAsMTA0LjY4LTYwLjk3LDE3My4xNi0xNTUuMDgsMTczLjE2aC0yMTcuMzdaTTM5NC42Myw1MzcuMzljLTQ3LjA1LDAtNzMuNTYsMjYuNzYtNzMuNTYsNzMuOTksMCw0OS41OSwzNy43Nyw3NC43Nyw5MC43OSw3NC43N2gxNzYuMjhjNTMuMDIsMCw5MC43OS0yNS4xOSw5MC43OS03NC43N3MtMjYuNTEtNzMuOTktNzMuNTYtNzMuOTloLTIxMC43NFpNNDE2LjUsMzEzLjA3Yy01NS4wMSwwLTg2LjE1LDE4LjEtODYuMTUsNzAuODQsMCw0OS41OSwyMi41Myw2OS4yNiw3MC4yNSw2OS4yNmgxOTguODFjNDcuNzIsMCw3MC4yNS0xOS42OCw3MC4yNS02OS4yNiwwLTUyLjc0LTMxLjE1LTcwLjg0LTg2LjE1LTcwLjg0aC0xNjdaIi8+CiAgPGc+CiAgICA8cGF0aCBjbGFzcz0iY2xzLTEiIGQ9Ik01MDkuNCw1Mi4xNWMtMjE2LjIyLDAtMzk4LjMsMTQzLjI0LTQ1Mi44NCwzMzguMTZoLTE5Ljc5QzkwLjcsMTg0Ljg5LDI3Ny42NSwzMy4zNSw1MDAsMzMuMzVzNDA5LjMsMTUxLjUzLDQ2My4yNCwzNTYuOTZoLTFjLTU0LjU0LTE5NC45My0yMzYuNjItMzM4LjE2LTQ1Mi44NC0zMzguMTZaIi8+CiAgICA8cGF0aCBjbGFzcz0iY2xzLTEiIGQ9Ik05NzkuMTUsNDAyLjU4aC0yNi4yMmwtMi41MS04Ljk2Yy01NC4yMy0xOTMuODMtMjM1LjU5LTMyOS4yLTQ0MS4wMi0zMjkuMlMxMjIuNiwxOTkuNzksNjguMzcsMzkzLjYybC0yLjUxLDguOTZIMjAuODVsNC4wNC0xNS4zOWMxMy42NS01MiwzNS42OS0xMDEuMTYsNjUuNTEtMTQ2LjExLDI5LjMzLTQ0LjIyLDY1LjQyLTgzLjI0LDEwNy4yNi0xMTUuOTYsNDIuMjYtMzMuMDUsODkuMjYtNTguNzgsMTM5LjY3LTc2LjQ3LDUyLjE2LTE4LjMsMTA2Ljg4LTI3LjU4LDE2Mi42Ni0yNy41OHMxMTAuNTEsOS4yOCwxNjIuNjYsMjcuNThjNTAuNDEsMTcuNjksOTcuNDEsNDMuNDIsMTM5LjY3LDc2LjQ3LDQxLjg0LDMyLjcyLDc3LjkzLDcxLjc0LDEwNy4yNiwxMTUuOTYsMjkuODIsNDQuOTUsNTEuODYsOTQuMTEsNjUuNTEsMTQ2LjExbDQuMDQsMTUuMzlaIi8+CiAgPC9nPgogIDxnPgogICAgPHBhdGggY2xhc3M9ImNscy0xIiBkPSJNNTA5LjQsOTQ3Ljg1Yy0yMTYuMjIsMC0zOTguMy0xNDMuMjQtNDUyLjg0LTMzOC4xNmgtMTkuNzljNTMuOTQsMjA1LjQzLDI0MC44OSwzNTYuOTYsNDYzLjI0LDM1Ni45NnM0MDkuMy0xNTEuNTMsNDYzLjI0LTM1Ni45NmgtMWMtNTQuNTQsMTk0LjkzLTIzNi42MiwzMzguMTYtNDUyLjg0LDMzOC4xNloiLz4KICAgIDxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTUwMCw5NzguOTJjLTU1Ljc4LDAtMTEwLjUxLTkuMjgtMTYyLjY2LTI3LjU4LTUwLjQxLTE3LjY5LTk3LjQxLTQzLjQyLTEzOS42Ny03Ni40Ny00MS44NC0zMi43Mi03Ny45My03MS43NC0xMDcuMjYtMTE1Ljk2LTI5LjgyLTQ0Ljk1LTUxLjg2LTk0LjExLTY1LjUxLTE0Ni4xMWwtNC4wNC0xNS4zOWg0NS4wMWwyLjUxLDguOTZjNTQuMjMsMTkzLjgzLDIzNS41OSwzMjkuMiw0NDEuMDMsMzI5LjJzMzg2Ljc5LTEzNS4zNyw0NDEuMDItMzI5LjJsMi41MS04Ljk2aDI2LjIybC00LjA0LDE1LjM5Yy0xMy42NSw1Mi0zNS42OSwxMDEuMTYtNjUuNTEsMTQ2LjExLTI5LjMzLDQ0LjIyLTY1LjQyLDgzLjI0LTEwNy4yNiwxMTUuOTYtNDIuMjYsMzMuMDUtODkuMjYsNTguNzgtMTM5LjY3LDc2LjQ3LTUyLjE2LDE4LjMtMTA2Ljg4LDI3LjU4LTE2Mi42NiwyNy41OFoiLz4KICA8L2c+Cjwvc3ZnPg=='
    const brandedSvg = svg.replace(
      '</svg>',
      `<rect x="42.5%" y="42.5%" width="15%" height="15%" rx="3" fill="#ffffff"/><image href="${logoDataUri}" x="44%" y="44%" width="12%" height="12%" preserveAspectRatio="xMidYMid meet"/></svg>`,
    )

    // Convert SVG to data URL for email embedding
    qrCodeUrl = `data:image/svg+xml;base64,${Buffer.from(brandedSvg).toString('base64')}`
  } catch (qrErr) {
    // Fallback to plain QR if logo embedding fails
    console.warn('[template-send] QR generation failed, falling back to plain QR', { bookingId, error: (qrErr as Error).message })
    qrCodeUrl = await QRCode.toDataURL(qrContent, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 500,
      margin: 4,
      color: { dark: '#0a0a0a', light: '#ffffff' },
    })
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
    '{{qrCodeUrl}}': qrCodeUrl,
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

