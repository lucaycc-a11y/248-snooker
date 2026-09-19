import { getResend } from './client'
import { BookingConfirmedEmail, type BookingConfirmedEmailProps } from './templates/booking-confirmed'
import { BookingRefundedEmail, type BookingRefundedEmailProps } from './templates/booking-refunded'
import { BookingRescheduledEmail, type BookingRescheduledEmailProps } from './templates/booking-rescheduled'
import { AdminInviteEmail } from './templates/admin-invite'
import { render } from '@react-email/render'
import { generateBookingQR, generateMemberQRWithLogo, getRecommendedQRSize } from '@/lib/qrcode'
import type { QrPayload } from '@/lib/qr/jwt'

type SendReceiptParams = {
  to: string
  booking: {
    id: string
    user_id: string
    date: string
    start_time: string
    end_time: string
    table_number: number
    total_price: number
    payment_method: string
    human_code?: string
    member_code?: string
  }
  paymentIntentId: string
  customerName: string
  customerPhone: string
  locale: 'zh-HK' | 'zh-CN' | 'en'
}

export async function sendBookingReceipt(params: SendReceiptParams) {
  const resend = getResend()

  // Use human_code (SPACE8-XXXXX-C format) as receipt number
  const receiptNumber = params.booking.human_code || `248-${params.booking.id.slice(0, 8).toUpperCase()}`

  // For now, assume no service fee (adjust if your pricing includes one)
  const subtotal = params.booking.total_price
  const serviceFee = 0
  const total = subtotal + serviceFee

  // Generate QR code for the receipt email.
  // Prefer member_code (encodes identity, shows branded logo) over the booking
  // human_code path — fall back only when member_code is unavailable.
  let qrCodeDataUrl: string
  let backupCode: string

  if (params.booking.member_code) {
    qrCodeDataUrl = await generateMemberQRWithLogo(
      params.booking.member_code,
      getRecommendedQRSize('email'),
    )
    backupCode = params.booking.human_code || `248-${params.booking.id.slice(0, 8).toUpperCase()}`
  } else {
    const startIso = `${params.booking.date}T${params.booking.start_time}`
    const endTimeHHMMSS = params.booking.end_time.length === 5 ? `${params.booking.end_time}:00` : params.booking.end_time
    const endIso = `${params.booking.date}T${endTimeHHMMSS}`

    const qrPayload: QrPayload = {
      booking_id: params.booking.id,
      user_id: params.booking.user_id,
      table_number: params.booking.table_number,
      start_time: startIso,
      end_time: endIso,
    }

    const result = await generateBookingQR(qrPayload, {
      format: 'data-url',
      width: getRecommendedQRSize('email'),
    })
    qrCodeDataUrl = result.qrCode as string
    backupCode = result.backupCode
  }

  const emailProps: BookingConfirmedEmailProps = {
    locale: params.locale,
    customerName: params.customerName,
    customerEmail: params.to,
    customerPhone: params.customerPhone,
    date: params.booking.date,
    startTime: params.booking.start_time.slice(0, 5),
    endTime: params.booking.end_time.slice(0, 5),
    tableNumber: params.booking.table_number,
    receiptNumber,
    subtotal,
    serviceFee,
    total,
    paymentMethod: params.booking.payment_method,
    paymentIntentId: params.paymentIntentId,
    qrCodeDataUrl,
    backupCode,
  }

  const html = await render(BookingConfirmedEmail(emailProps))

  const subjectLines = {
    'zh-HK': '你的預訂已確認 — Space8',
    'zh-CN': '你的预订已确认 — Space8',
    en: 'Your booking is confirmed — Space8',
  }

  await resend.emails.send({
    from: 'Space8 <no-reply@space8.com.hk>',
    to: params.to,
    subject: subjectLines[params.locale],
    html,
  })
}

type SendRefundedParams = {
  to: string
  booking: {
    id: string
    date: string
    start_time: string
    end_time: string
    table_number: number
    human_code?: string
  }
  originalPrice: number
  refundFee: number
  refundAmount: number
  cancellationReason?: string | null
  customerName: string
  locale: 'zh-HK' | 'zh-CN' | 'en'
}

export async function sendBookingRefundedEmail(params: SendRefundedParams) {
  const resend = getResend()

  const receiptNumber = params.booking.human_code || `248-${params.booking.id.slice(0, 8).toUpperCase()}`

  const emailProps: BookingRefundedEmailProps = {
    locale: params.locale,
    customerName: params.customerName,
    customerEmail: params.to,
    date: params.booking.date,
    startTime: params.booking.start_time.slice(0, 5),
    endTime: params.booking.end_time.slice(0, 5),
    tableNumber: params.booking.table_number,
    receiptNumber,
    originalPrice: params.originalPrice,
    refundFee: params.refundFee,
    refundAmount: params.refundAmount,
    cancellationReason: params.cancellationReason,
  }

  const html = await render(BookingRefundedEmail(emailProps))

  const subjectLines = {
    'zh-HK': '你的退款已處理 — Space8',
    'zh-CN': '你的退款已处理 — Space8',
    en: 'Your refund has been processed — Space8',
  }

  await resend.emails.send({
    from: 'Space8 <no-reply@space8.com.hk>',
    to: params.to,
    subject: subjectLines[params.locale],
    html,
  })
}

type SendRescheduledParams = {
  to: string
  booking: {
    id: string
    table_number: number
    human_code?: string
  }
  oldDate: string
  oldStartTime: string
  oldEndTime: string
  newDate: string
  newStartTime: string
  newEndTime: string
  customerName: string
  locale: 'zh-HK' | 'zh-CN' | 'en'
}

export async function sendBookingRescheduledEmail(params: SendRescheduledParams) {
  const resend = getResend()

  const receiptNumber = params.booking.human_code || `248-${params.booking.id.slice(0, 8).toUpperCase()}`

  const emailProps: BookingRescheduledEmailProps = {
    locale: params.locale,
    customerName: params.customerName,
    customerEmail: params.to,
    oldDate: params.oldDate,
    oldStartTime: params.oldStartTime.slice(0, 5),
    oldEndTime: params.oldEndTime.slice(0, 5),
    newDate: params.newDate,
    newStartTime: params.newStartTime.slice(0, 5),
    newEndTime: params.newEndTime.slice(0, 5),
    tableNumber: params.booking.table_number,
    receiptNumber,
  }

  const html = await render(BookingRescheduledEmail(emailProps))

  const subjectLines = {
    'zh-HK': '你的預訂已改期 — Space8',
    'zh-CN': '你的预订已改期 — Space8',
    en: 'Your booking has been rescheduled — Space8',
  }

  await resend.emails.send({
    from: 'Space8 <no-reply@space8.com.hk>',
    to: params.to,
    subject: subjectLines[params.locale],
    html,
  })
}

type SendAdminInviteParams = {
  to: string
  inviteUrl: string
  role: 'admin' | 'super_admin'
}

export async function sendAdminInviteEmail(params: SendAdminInviteParams) {
  const resend = getResend()

  const html = await render(AdminInviteEmail({ inviteUrl: params.inviteUrl, role: params.role }))

  await resend.emails.send({
    from: 'Space8 <no-reply@space8.com.hk>',
    to: params.to,
    subject: "You've been invited to Space8 Admin",
    html,
  })
}
