import { getResend } from './client'
import { getServiceSupabase } from '@/lib/supabase/service'
import QRCode from 'qrcode'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOM_NAMES: Record<number, { en: string; zh: string }> = {
  1: { en: 'Space Infinity', zh: '無限空間球室' },
  2: { en: 'Space Eternity', zh: '永恆空間球室' },
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  alipay_hk: '支付寶香港 AlipayHK',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
  card: '信用卡 Card',
  wechat_pay: '微信支付 WeChat Pay',
  free: '免費 Free',
}

/**
 * Load and render the booking confirmation HTML template by substituting
 * {{variable}} placeholders with real values from the database.
 *
 * The template lives at lib/resend/templates/booking-confirmation.html and
 * uses plain {{variable}} syntax (no JSX, no React Email).
 */
async function renderBookingConfirmationHtml(bookingId: string): Promise<{
  html: string
  subject: string
  to: string
}> {
  const supabase = getServiceSupabase()

  // ── Fetch booking ──────────────────────────────────────────────────────────
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select('id, user_id, date, start_time, end_time, duration_hours, total_price, table_number, payment_method, human_code, booking_reference, qr_code, status')
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

  // ── Derive values ──────────────────────────────────────────────────────────

  // Customer name: use display_name, fallback to phone, never show "Unknown"
  const customerName = user.display_name ?? user.phone ?? ''
  const customerEmail = user.email ?? ''

  // Room name from table_number
  const roomInfo = ROOM_NAMES[booking.table_number] ?? { en: `Table ${booking.table_number}`, zh: `${booking.table_number}號枱` }

  // Format date: "2026年7月30日 (週三)"
  const dateObj = new Date(booking.date + 'T00:00:00+08:00')
  const dayNames = ['日', '一', '二', '三', '四', '五', '六']
  const bookingDate = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日 (週${dayNames[dateObj.getDay()]})`

  // Format times: HH:mm (strip trailing :00 if present)
  const startTime = booking.start_time.slice(0, 5)
  const endTime = booking.end_time.slice(0, 5)

  // Duration hours
  const durationHours = Number(booking.duration_hours)

  // Payment method label
  const paymentMethod = PAYMENT_METHOD_LABELS[booking.payment_method ?? ''] ?? (booking.payment_method ?? '—')

  // Total price (already integer HK$)
  const totalPrice = booking.total_price

  // QR code image: generate from the stored qr_code value
  const qrCodeDataUrl = await QRCode.toDataURL(booking.qr_code ?? '', {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    width: 500,
    margin: 4,
    color: { dark: '#000000', light: '#FFFFFF' },
  })

  // Booking detail URL
  const bookingDetailUrl = `https://space8.com.hk/book?bc=${booking.human_code ?? ''}`

  // WhatsApp number from bot_config
  let whatsappNumber = '85264274620' // fallback
  try {
    const { data: config } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'admin_phones')
      .single()

    if (config?.value && Array.isArray(config.value) && config.value.length > 0) {
      whatsappNumber = String(config.value[0])
    }
  } catch {
    // non-fatal — use fallback
  }

  // ── Load template and substitute ───────────────────────────────────────────
  const templatePath = join(process.cwd(), 'lib', 'resend', 'templates', 'booking-confirmation.html')
  let html = readFileSync(templatePath, 'utf-8')

  const replacements: Record<string, string> = {
    '{{customerName}}': customerName,
    '{{customerEmail}}': customerEmail,
    '{{startTime}}': startTime,
    '{{endTime}}': endTime,
    '{{bookingDate}}': bookingDate,
    '{{roomName}}': roomInfo.en,
    '{{roomNameZh}}': roomInfo.zh,
    '{{bookingReference}}': booking.booking_reference ?? '',
    '{{humanCode}}': booking.human_code ?? '',
    '{{durationHours}}': String(durationHours),
    '{{paymentMethod}}': paymentMethod,
    '{{totalPrice}}': String(totalPrice),
    '{{qrCodeUrl}}': qrCodeDataUrl,
    '{{whatsappNumber}}': whatsappNumber,
    '{{bookingDetailUrl}}': bookingDetailUrl,
  }

  for (const [key, value] of Object.entries(replacements)) {
    html = html.replaceAll(key, value)
  }

  // ── Check for unsubstituted variables ──────────────────────────────────────
  const unsubstituted = html.match(/\{\{.+?\}\}/g)
  if (unsubstituted && unsubstituted.length > 0) {
    console.warn('[template-send] unsubstituted variables detected:', unsubstituted)
  }

  const subject = `預約已確認 Booking Confirmed · ${booking.booking_reference ?? booking.human_code ?? ''}`

  return { html, subject, to: customerEmail }
}

export async function sendBookingConfirmation(bookingId: string): Promise<void> {
  const { html, subject, to } = await renderBookingConfirmationHtml(bookingId)

  if (!to) {
    console.warn('[template-send] no recipient email, skipping send', { bookingId })
    return
  }

  const resend = getResend()

  await resend.emails.send({
    from: 'SPACE8 <bookings@space8.com.hk>',
    to,
    subject,
    html,
  })

  console.log('[template-send] booking confirmation email sent', { bookingId, to })
}