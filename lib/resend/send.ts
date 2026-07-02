import { getResend } from './client'
import { BookingConfirmedEmail, type BookingConfirmedEmailProps } from './templates/booking-confirmed'
import { BookingRefundedEmail, type BookingRefundedEmailProps } from './templates/booking-refunded'
import { BookingRescheduledEmail, type BookingRescheduledEmailProps } from './templates/booking-rescheduled'
import { render } from '@react-email/render'

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
  }
  paymentIntentId: string
  customerName: string
  customerPhone: string
  locale: 'zh-HK' | 'zh-CN' | 'en' | 'ja'
}

export async function sendBookingReceipt(params: SendReceiptParams) {
  const resend = getResend()

  // Generate receipt number from booking ID (e.g., "248-12345")
  const receiptNumber = `248-${params.booking.id.slice(0, 8).toUpperCase()}`

  // For now, assume no service fee (adjust if your pricing includes one)
  const subtotal = params.booking.total_price
  const serviceFee = 0
  const total = subtotal + serviceFee

  const emailProps: BookingConfirmedEmailProps = {
    locale: params.locale,
    customerName: params.customerName,
    customerEmail: params.to,
    customerPhone: params.customerPhone,
    date: params.booking.date,
    startTime: params.booking.start_time.slice(0, 5), // "HH:mm:ss" -> "HH:mm"
    endTime: params.booking.end_time.slice(0, 5),
    tableNumber: params.booking.table_number,
    receiptNumber,
    subtotal,
    serviceFee,
    total,
    paymentMethod: params.booking.payment_method,
    paymentIntentId: params.paymentIntentId,
  }

  const html = await render(BookingConfirmedEmail(emailProps))

  const subjectLines = {
    'zh-HK': '你嘅預訂已確認 — Space8',
    'zh-CN': '你的预订已确认 — Space8',
    en: 'Your booking is confirmed — Space8',
    ja: 'ご予約が確認されました — Space8',
  }

  await resend.emails.send({
    from: 'Space8 <bookings@248.formhk.com>',
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
  }
  originalPrice: number
  refundFee: number
  refundAmount: number
  cancellationReason?: string | null
  customerName: string
  locale: 'zh-HK' | 'zh-CN' | 'en' | 'ja'
}

export async function sendBookingRefundedEmail(params: SendRefundedParams) {
  const resend = getResend()

  const receiptNumber = `248-${params.booking.id.slice(0, 8).toUpperCase()}`

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
    'zh-HK': '你嘅退款已處理 — Space8',
    'zh-CN': '你的退款已处理 — Space8',
    en: 'Your refund has been processed — Space8',
    ja: 'ご返金処理が完了しました — Space8',
  }

  await resend.emails.send({
    from: 'Space8 <bookings@248.formhk.com>',
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
  }
  oldDate: string
  oldStartTime: string
  oldEndTime: string
  newDate: string
  newStartTime: string
  newEndTime: string
  customerName: string
  locale: 'zh-HK' | 'zh-CN' | 'en' | 'ja'
}

export async function sendBookingRescheduledEmail(params: SendRescheduledParams) {
  const resend = getResend()

  const receiptNumber = `248-${params.booking.id.slice(0, 8).toUpperCase()}`

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
    'zh-HK': '你嘅預訂已改期 — Space8',
    'zh-CN': '你的预订已改期 — Space8',
    en: 'Your booking has been rescheduled — Space8',
    ja: 'ご予約が変更されました — Space8',
  }

  await resend.emails.send({
    from: 'Space8 <bookings@248.formhk.com>',
    to: params.to,
    subject: subjectLines[params.locale],
    html,
  })
}
