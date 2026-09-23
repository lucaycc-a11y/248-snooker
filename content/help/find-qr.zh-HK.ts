import type { HelpArticleContent } from './types'

export const findQrZhHK: HelpArticleContent = {
  title: '如何找回您的 QR Code',
  intro: '如果您遺失了預訂的 QR Code，可以透過以下方法重新取得。',
  sections: [
    {
      title: '透過會員帳戶查看',
      content: [
        '1. 登入您的 Space8 會員帳戶',
        '2. 進入「我的預訂」頁面',
        '3. 找到相關預訂',
        '4. 點擊「查看 QR Code」',
        '5. QR Code 會立即顯示在螢幕上',
        {
          type: 'callout',
          variant: 'info',
          text: '您可以將 QR Code 截圖保存，或直接在手機上顯示使用。',
        },
      ],
    },
    {
      title: '重新發送至電郵',
      content: [
        '如果您無法登入帳戶，可以要求系統重新發送 QR Code：',
        '',
        '1. 在登入頁面選擇「需要協助？」',
        '2. 選擇「重新發送 QR Code」',
        '3. 輸入您的預訂編號和註冊電郵',
        '4. 系統會將 QR Code 重新發送至您的電郵',
        '',
        '預訂編號格式：SPACE8-XXXXX-C（可在原始預訂確認電郵中找到）',
      ],
    },
    {
      title: '聯絡客戶服務',
      content: [
        '如果以上方法仍無法取得 QR Code，請立即聯絡我們：',
        '',
        '**WhatsApp: 6180 8022**',
        '請提供以下資料：',
        '• 預訂編號（格式：SPACE8-XXXXX-C）',
        '• 註冊電郵地址',
        '• 預訂日期和時段',
        '',
        '**電郵: Admin@space8.com.hk**',
        '我們會在收到您的訊息後盡快協助您重新發送 QR Code。',
      ],
    },
    {
      title: '預防措施',
      content: [
        '為避免找不到 QR Code 的情況，建議您：',
        '• 收到 QR Code 後立即截圖保存',
        '• 將預訂確認電郵標記為重要郵件',
        '• 在預訂當天提前檢查 QR Code 是否可用',
        '• 確保您的會員帳戶登入資料安全保存',
      ],
    },
  ],
}
