import { describe, expect, it } from 'vitest'
import { render } from '@react-email/render'
import {
  bookingConfirmationTemplate,
  bookingConfirmationQrImageHtml,
} from './booking-confirmation'
import { BookingConfirmedEmail } from './booking-confirmed'

const NEW_LABEL = '你的專屬會員QR code'
const OLD_LABELS = ['入場 QR Code', '入場QR Code', 'Entry QR Code']

describe('booking confirmation email QR label', () => {
  it('live template (booking-confirmation.ts) uses the member QR label in heading and alt', () => {
    const html = bookingConfirmationTemplate.replaceAll(
      '{{qrImageHtml}}',
      bookingConfirmationQrImageHtml('qr-test'),
    )
    expect(html).toContain(`>\n                  ${NEW_LABEL}\n`)
    expect(html).toContain(`alt="${NEW_LABEL}"`)
    for (const old of OLD_LABELS) expect(html).not.toContain(old)
  })

  it('React receipt template (booking-confirmed.tsx) renders the new label for zh-HK', async () => {
    const html = await render(
      BookingConfirmedEmail({
        locale: 'zh-HK',
        customerName: 'Test',
        customerEmail: 'test@example.invalid',
        customerPhone: '+85200000000',
        date: '2026-10-13',
        startTime: '10:00',
        endTime: '11:00',
        tableNumber: 1,
        receiptNumber: 'R-TEST',
        subtotal: 100,
        serviceFee: 0,
        total: 100,
        paymentMethod: 'card',
        paymentIntentId: 'pi_test',
        qrCodeDataUrl: 'data:image/png;base64,AAAA',
      }),
    )
    expect(html).toContain(NEW_LABEL)
    expect(html).toContain(`alt="${NEW_LABEL}"`)
    for (const old of OLD_LABELS) expect(html).not.toContain(old)
  })
})
