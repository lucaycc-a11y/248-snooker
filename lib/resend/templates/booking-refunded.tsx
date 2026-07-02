import * as React from 'react'

export type BookingRefundedEmailProps = {
  locale: 'zh-HK' | 'zh-CN' | 'en' | 'ja'
  customerName: string
  customerEmail: string
  date: string // YYYY-MM-DD
  startTime: string // HH:mm
  endTime: string // HH:mm
  tableNumber: number
  receiptNumber: string
  originalPrice: number // HK$
  refundFee: number // HK$
  refundAmount: number // HK$
  cancellationReason?: string | null
}

const LOCALE_TEXT = {
  'zh-HK': {
    title: '退款已處理',
    receiptNumber: '收據編號',
    tableLabel: 'Space8 · 枱號',
    originalPrice: '原價',
    refundFee: '手續費',
    refundAmount: '退款金額',
    refundNotice: '退款將於 5-10 個工作天內存入你的原付款方式。',
    reasonLabel: '原因',
    footer: 'Space8 · Hong Kong',
  },
  'zh-CN': {
    title: '退款已处理',
    receiptNumber: '收据编号',
    tableLabel: 'Space8 · 台号',
    originalPrice: '原价',
    refundFee: '手续费',
    refundAmount: '退款金额',
    refundNotice: '退款将于 5-10 个工作日内存入你的原付款方式。',
    reasonLabel: '原因',
    footer: 'Space8 · Hong Kong',
  },
  en: {
    title: 'Refund Processed',
    receiptNumber: 'Receipt No.',
    tableLabel: 'Space8 · Table',
    originalPrice: 'Original Price',
    refundFee: 'Refund Fee',
    refundAmount: 'Refund Amount',
    refundNotice: 'Your refund will appear in your original payment method within 5-10 business days.',
    reasonLabel: 'Reason',
    footer: 'Space8 · Hong Kong',
  },
  ja: {
    title: '返金処理完了',
    receiptNumber: '領収書番号',
    tableLabel: 'Space8 · テーブル',
    originalPrice: '元の価格',
    refundFee: '手数料',
    refundAmount: '返金額',
    refundNotice: '返金は5〜10営業日以内に元のお支払い方法に反映されます。',
    reasonLabel: '理由',
    footer: 'Space8 · Hong Kong',
  },
}

export function BookingRefundedEmail({
  locale,
  customerName,
  customerEmail,
  date,
  startTime,
  endTime,
  tableNumber,
  receiptNumber,
  originalPrice,
  refundFee,
  refundAmount,
  cancellationReason,
}: BookingRefundedEmailProps) {
  const t = LOCALE_TEXT[locale]

  return (
    <div style={{ backgroundColor: '#000000', padding: '48px 24px', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" }}>
      <table role="presentation" width="100%" style={{ maxWidth: '480px', margin: '0 auto' }}>
        <tbody>
          <tr>
            <td style={{ textAlign: 'center', paddingBottom: '32px' }}>
              <span style={{ color: '#22c55e', fontFamily: "'Bebas Neue', sans-serif", fontSize: '24px', letterSpacing: '2px' }}>
                SPACE8
              </span>
            </td>
          </tr>
          <tr>
            <td style={{ backgroundColor: '#0a0a0a', borderRadius: '24px', padding: '40px 32px' }}>
              <h1 style={{ color: '#ffffff', fontSize: '22px', fontWeight: 600, margin: '0 0 8px', textAlign: 'center' }}>
                {t.title}
              </h1>
              <p style={{ color: '#a3a3a3', fontSize: '14px', textAlign: 'center', margin: '0 0 32px' }}>
                {t.receiptNumber}：{receiptNumber}
              </p>

              {/* Booking details */}
              <div style={{ borderTop: '1px solid #262626', borderBottom: '1px solid #262626', padding: '20px 0', marginBottom: '20px' }}>
                <p style={{ color: '#ffffff', fontSize: '16px', margin: '0 0 4px' }}>
                  {date} · {startTime}–{endTime}
                </p>
                <p style={{ color: '#a3a3a3', fontSize: '14px', margin: 0 }}>
                  {t.tableLabel} #{tableNumber}
                </p>
              </div>

              {/* Customer info */}
              <div style={{ marginBottom: '20px' }}>
                <p style={{ color: '#ffffff', fontSize: '15px', margin: '0 0 4px' }}>{customerName}</p>
                <p style={{ color: '#a3a3a3', fontSize: '13px', margin: 0 }}>{customerEmail}</p>
              </div>

              {/* Refund breakdown */}
              <table width="100%" style={{ marginBottom: '8px' }}>
                <tbody>
                  <tr>
                    <td style={{ color: '#a3a3a3', fontSize: '14px', padding: '4px 0' }}>{t.originalPrice}</td>
                    <td style={{ color: '#ffffff', fontSize: '14px', textAlign: 'right' }}>HK${originalPrice}</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#a3a3a3', fontSize: '14px', padding: '4px 0' }}>{t.refundFee}</td>
                    <td style={{ color: '#ffffff', fontSize: '14px', textAlign: 'right' }}>-HK${refundFee}</td>
                  </tr>
                </tbody>
              </table>
              <div style={{ borderTop: '1px solid #262626', paddingTop: '12px', marginTop: '8px' }}>
                <table width="100%">
                  <tbody>
                    <tr>
                      <td style={{ color: '#ffffff', fontSize: '16px', fontWeight: 600 }}>{t.refundAmount}</td>
                      <td style={{ color: '#22c55e', fontSize: '20px', fontWeight: 700, textAlign: 'right' }}>HK${refundAmount}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {cancellationReason ? (
                <p style={{ color: '#525252', fontSize: '13px', margin: '20px 0 0' }}>
                  {t.reasonLabel}：{cancellationReason}
                </p>
              ) : null}
            </td>
          </tr>

          {/* Refund timing footer */}
          <tr>
            <td style={{ paddingTop: '24px' }}>
              <p style={{ color: '#525252', fontSize: '11px', lineHeight: '1.6', textAlign: 'center', margin: 0 }}>
                {t.refundNotice}
              </p>
            </td>
          </tr>

          <tr>
            <td style={{ textAlign: 'center', paddingTop: '16px' }}>
              <span style={{ color: '#525252', fontSize: '12px' }}>{t.footer}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
