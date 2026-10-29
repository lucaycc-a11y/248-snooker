// PaymentX — KPay 全托管收銀台 (hosted cashier) as its own payment system.
// Separate from the live KPay direct-connect flow (lib/payments). Admin-selected
// test accounts only until it is promoted.

export const PAYMENTX_VERSION = 'X1.0.0'
export const PAYMENTX_LABEL = `PaymentX v${PAYMENTX_VERSION}`

export type PaymentXChangelogEntry = {
  version: string
  date: string
  title: string
  changes: string[]
}

export const PAYMENTX_CHANGELOG: PaymentXChangelogEntry[] = [
  {
    version: 'X1.0.0',
    date: '2026-10-29',
    title: 'First release: KPay 全托管收銀台，只限後台揀選嘅測試帳戶',
    changes: [
      '新增獨立付款系統 PaymentX：用 KPay 全托管收銀台（/v1/managed/order/add），由 KPay 頁面揀付款方式。',
      '只有後台「PaymentX」入面加咗嘅帳戶，結帳頁先會見到入口；其他客人流程完全冇變。',
      '一個預約只對應一張全托管訂單，重新打開收銀台沿用同一張單，唔會開新單令客人付兩次。',
      '付款結果以 KPay 查詢結果為準（notify 只當觸發）；已付款自動確認預約，時段已被佔用就轉人手覆核，唔會自動退款。',
      '擁有自己嘅訂單表同事件紀錄，後台可睇最近訂單、手動同步、睇 KPay 通知原文。',
    ],
  },
]
