import * as React from 'react'

export type BookingConfirmedEmailProps = {
  locale: 'zh-HK' | 'zh-CN' | 'en' | 'ja'
  customerName: string
  customerEmail: string
  customerPhone: string
  date: string // YYYY-MM-DD
  startTime: string // HH:mm
  endTime: string // HH:mm
  tableNumber: number
  receiptNumber: string
  subtotal: number // HK$
  serviceFee: number // HK$
  total: number // HK$
  paymentMethod: string
  paymentIntentId: string
  qrCodeDataUrl?: string // Base64-encoded QR code PNG
  backupCode?: string // Human-readable backup code (e.g., 248-XXXXXXXX-XXXX-CC)
}

const LOCALE_TEXT = {
  'zh-HK': {
    title: '預訂已確認',
    receiptNumber: '收據編號',
    tableLabel: 'Space8 · 枱號',
    subtotal: '小計',
    serviceFee: '服務費',
    total: '總計',
    paymentMethod: '付款方式',
    transactionId: '交易編號',
    qrTitle: '入場QR Code',
    qrInstructions: '到場時掃描此QR Code即可開門入場',
    backupCodeLabel: '後備密碼',
    backupCodeInstructions: '如QR Code無法掃描，請向職員提供此密碼',
    legalNotice: '此電郵為交易確認及收據，請妥善保存。退款政策請參閱',
    refundPolicyLink: '退款條款',
    footer: 'Space8 · Hong Kong',
  },
  'zh-CN': {
    title: '预订已确认',
    receiptNumber: '收据编号',
    tableLabel: 'Space8 · 台号',
    subtotal: '小计',
    serviceFee: '服务费',
    total: '总计',
    paymentMethod: '付款方式',
    transactionId: '交易编号',
    qrTitle: '入场QR Code',
    qrInstructions: '到场时扫描此QR Code即可开门入场',
    backupCodeLabel: '备用密码',
    backupCodeInstructions: '如QR Code无法扫描，请向职员提供此密码',
    legalNotice: '此邮件为交易确认及收据，请妥善保存。退款政策请参阅',
    refundPolicyLink: '退款条款',
    footer: 'Space8 · Hong Kong',
  },
  en: {
    title: 'Booking Confirmed',
    receiptNumber: 'Receipt No.',
    tableLabel: 'Space8 · Table',
    subtotal: 'Subtotal',
    serviceFee: 'Service Fee',
    total: 'Total',
    paymentMethod: 'Payment Method',
    transactionId: 'Transaction ID',
    qrTitle: 'Entry QR Code',
    qrInstructions: 'Scan this QR code at the door for entry',
    backupCodeLabel: 'Backup Code',
    backupCodeInstructions: 'If QR code fails to scan, provide this code to staff',
    legalNotice: 'This email serves as transaction confirmation and receipt. Please keep it for your records. For refund policy, please see',
    refundPolicyLink: 'Refund Policy',
    footer: 'Space8 · Hong Kong',
  },
  ja: {
    title: '予約確認',
    receiptNumber: '領収書番号',
    tableLabel: 'Space8 · テーブル',
    subtotal: '小計',
    serviceFee: 'サービス料',
    total: '合計',
    paymentMethod: '支払方法',
    transactionId: '取引ID',
    qrTitle: '入場QRコード',
    qrInstructions: 'ドアでこのQRコードをスキャンしてください',
    backupCodeLabel: 'バックアップコード',
    backupCodeInstructions: 'QRコードがスキャンできない場合、このコードをスタッフに提供してください',
    legalNotice: 'このメールは取引確認と領収書です。記録として保管してください。返金ポリシーについては',
    refundPolicyLink: '返金規約',
    footer: 'Space8 · Hong Kong',
  },
}

const PAYMENT_METHOD_LABELS: Record<string, Record<string, string>> = {
  card: { 'zh-HK': '信用卡/扣賬卡', 'zh-CN': '信用卡/借记卡', en: 'Card', ja: 'カード' },
  apple_pay: { 'zh-HK': 'Apple Pay', 'zh-CN': 'Apple Pay', en: 'Apple Pay', ja: 'Apple Pay' },
  google_pay: { 'zh-HK': 'Google Pay', 'zh-CN': 'Google Pay', en: 'Google Pay', ja: 'Google Pay' },
  alipay_hk: { 'zh-HK': '支付寶', 'zh-CN': '支付宝', en: 'Alipay', ja: 'Alipay' },
  wechat_pay: { 'zh-HK': '微信支付', 'zh-CN': '微信支付', en: 'WeChat Pay', ja: 'WeChat Pay' },
}

export function BookingConfirmedEmail({
  locale,
  customerName,
  customerEmail,
  customerPhone,
  date,
  startTime,
  endTime,
  tableNumber,
  receiptNumber,
  subtotal,
  serviceFee,
  total,
  paymentMethod,
  paymentIntentId,
  qrCodeDataUrl,
  backupCode,
}: BookingConfirmedEmailProps) {
  const t = LOCALE_TEXT[locale]
  const pmLabel = PAYMENT_METHOD_LABELS[paymentMethod]?.[locale] || paymentMethod

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

              {/* QR Code Section */}
              {qrCodeDataUrl && (
                <div style={{ marginBottom: '32px', textAlign: 'center' }}>
                  <h2 style={{ color: '#22c55e', fontSize: '16px', fontWeight: 600, margin: '0 0 12px' }}>
                    {t.qrTitle}
                  </h2>
                  <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    padding: '16px',
                    display: 'inline-block',
                    boxShadow: '0 0 20px rgba(34,197,94,0.15)'
                  }}>
                    <img
                      src={qrCodeDataUrl}
                      alt="Booking QR Code"
                      width="240"
                      height="240"
                      style={{ display: 'block', margin: '0 auto' }}
                    />
                  </div>
                  <p style={{ color: '#a3a3a3', fontSize: '13px', margin: '12px 0 0', lineHeight: '1.5' }}>
                    {t.qrInstructions}
                  </p>

                  {/* Backup Code */}
                  {backupCode && (
                    <div style={{
                      marginTop: '16px',
                      padding: '12px 16px',
                      backgroundColor: 'rgba(34,197,94,0.08)',
                      borderRadius: '12px',
                      border: '1px solid rgba(34,197,94,0.2)'
                    }}>
                      <p style={{ color: '#a3a3a3', fontSize: '12px', margin: '0 0 6px' }}>
                        {t.backupCodeLabel}
                      </p>
                      <p style={{
                        color: '#22c55e',
                        fontSize: '16px',
                        fontWeight: 600,
                        margin: '0 0 6px',
                        fontFamily: 'monospace',
                        letterSpacing: '1px'
                      }}>
                        {backupCode}
                      </p>
                      <p style={{ color: '#737373', fontSize: '11px', margin: 0, lineHeight: '1.4' }}>
                        {t.backupCodeInstructions}
                      </p>
                    </div>
                  )}
                </div>
              )}

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
                <p style={{ color: '#a3a3a3', fontSize: '13px', margin: 0 }}>
                  {customerEmail} · {customerPhone}
                </p>
              </div>

              {/* Price breakdown */}
              <table width="100%" style={{ marginBottom: '8px' }}>
                <tbody>
                  <tr>
                    <td style={{ color: '#a3a3a3', fontSize: '14px', padding: '4px 0' }}>{t.subtotal}</td>
                    <td style={{ color: '#ffffff', fontSize: '14px', textAlign: 'right' }}>HK${subtotal}</td>
                  </tr>
                  <tr>
                    <td style={{ color: '#a3a3a3', fontSize: '14px', padding: '4px 0' }}>{t.serviceFee}</td>
                    <td style={{ color: '#ffffff', fontSize: '14px', textAlign: 'right' }}>HK${serviceFee}</td>
                  </tr>
                </tbody>
              </table>
              <div style={{ borderTop: '1px solid #262626', paddingTop: '12px', marginTop: '8px' }}>
                <table width="100%">
                  <tbody>
                    <tr>
                      <td style={{ color: '#ffffff', fontSize: '16px', fontWeight: 600 }}>{t.total}</td>
                      <td style={{ color: '#22c55e', fontSize: '20px', fontWeight: 700, textAlign: 'right' }}>HK${total}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Payment method */}
              <p style={{ color: '#525252', fontSize: '13px', margin: '20px 0 0' }}>
                {t.paymentMethod}：{pmLabel} · {t.transactionId}：{paymentIntentId}
              </p>
            </td>
          </tr>

          {/* Legal footer */}
          <tr>
            <td style={{ paddingTop: '24px' }}>
              <p style={{ color: '#525252', fontSize: '11px', lineHeight: '1.6', textAlign: 'center', margin: 0 }}>
                {t.legalNotice}{' '}
                <a href="https://space8.com.hk/legal/refund-policy" style={{ color: '#22c55e', textDecoration: 'none' }}>
                  {t.refundPolicyLink}
                </a>
                。
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
