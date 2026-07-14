import * as React from 'react'

export type BookingRescheduledEmailProps = {
  locale: 'zh-HK' | 'zh-CN' | 'en' | 'ja'
  customerName: string
  customerEmail: string
  oldDate: string // YYYY-MM-DD
  oldStartTime: string // HH:mm
  oldEndTime: string // HH:mm
  newDate: string // YYYY-MM-DD
  newStartTime: string // HH:mm
  newEndTime: string // HH:mm
  tableNumber: number
  receiptNumber: string
}

const LOCALE_TEXT = {
  'zh-HK': {
    title: '預訂已改期',
    receiptNumber: '收據編號',
    tableLabel: 'Space8 · 枱號',
    previous: '原時段',
    updated: '新時段',
    footer: 'Space8 · Hong Kong',
  },
  'zh-CN': {
    title: '预订已改期',
    receiptNumber: '收据编号',
    tableLabel: 'Space8 · 台号',
    previous: '原时段',
    updated: '新时段',
    footer: 'Space8 · Hong Kong',
  },
  en: {
    title: 'Booking Rescheduled',
    receiptNumber: 'Receipt No.',
    tableLabel: 'Space8 · Table',
    previous: 'Previous',
    updated: 'New',
    footer: 'Space8 · Hong Kong',
  },
  ja: {
    title: '予約変更完了',
    receiptNumber: '領収書番号',
    tableLabel: 'Space8 · テーブル',
    previous: '変更前',
    updated: '変更後',
    footer: 'Space8 · Hong Kong',
  },
}

export function BookingRescheduledEmail({
  locale,
  customerName,
  customerEmail,
  oldDate,
  oldStartTime,
  oldEndTime,
  newDate,
  newStartTime,
  newEndTime,
  tableNumber,
  receiptNumber,
}: BookingRescheduledEmailProps) {
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

              {/* Previous slot */}
              <div style={{ borderTop: '1px solid #262626', padding: '20px 0 12px' }}>
                <p style={{ color: '#525252', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>
                  {t.previous}
                </p>
                <p style={{ color: '#525252', fontSize: '16px', margin: 0, textDecoration: 'line-through' }}>
                  {oldDate} · {oldStartTime}–{oldEndTime}
                </p>
              </div>

              {/* New slot */}
              <div style={{ borderBottom: '1px solid #262626', padding: '12px 0 20px', marginBottom: '20px' }}>
                <p style={{ color: '#22c55e', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>
                  {t.updated}
                </p>
                <p style={{ color: '#ffffff', fontSize: '16px', margin: '0 0 4px' }}>
                  {newDate} · {newStartTime}–{newEndTime}
                </p>
                <p style={{ color: '#a3a3a3', fontSize: '14px', margin: 0 }}>
                  {t.tableLabel} #{tableNumber}
                </p>
              </div>

              {/* Customer info */}
              <div>
                <p style={{ color: '#ffffff', fontSize: '15px', margin: '0 0 4px' }}>{customerName}</p>
                <p style={{ color: '#a3a3a3', fontSize: '13px', margin: 0 }}>{customerEmail}</p>
              </div>
            </td>
          </tr>

          <tr>
            <td style={{ textAlign: 'center', paddingTop: '24px' }}>
              <span style={{ color: '#525252', fontSize: '12px' }}>{t.footer}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
