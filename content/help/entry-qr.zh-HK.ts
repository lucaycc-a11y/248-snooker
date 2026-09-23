import type { HelpArticleContent } from './types'

export const entryQrZhHK: HelpArticleContent = {
  title: '如何使用會員 QR Code 進入場地',
  intro: '完成預訂付款後，您將收到一個專屬 QR Code，用於進入 Space8 場地。',
  sections: [
    {
      title: '您的 QR Code 在哪裡',
      content: [
        '付款成功後，系統會自動將 QR Code 發送至您的註冊電郵地址。',
        '您亦可隨時登入會員帳戶，在「我的預訂」中查看所有有效的 QR Code。',
      ],
    },
    {
      title: '如何使用 QR Code 進場',
      content: [
        '1. 到達 Space8 場地後，在入口處找到 QR Code 掃描器',
        '2. 打開您的 QR Code（可使用手機螢幕顯示，或列印紙本）',
        '3. 將 QR Code 對準掃描器',
        '4. 聽到「嗶」聲後，門鎖會自動打開',
        '5. 進入場地並開始享受您的預訂時段',
      ],
    },
    {
      title: '提早到達或延遲離開的時間寬限',
      content: [
        '為方便會員，Space8 提供以下時間寬限：',
        '• 提早進場：您可在預訂開始時間前 10 分鐘進場',
        '• 延遲離場：您可在預訂結束時間後 10 分鐘內離場',
        {
          type: 'callout',
          variant: 'info',
          text: '請注意：這些寬限時間僅供進出場地使用，不會延長您的預訂時段本身。',
        },
      ],
    },
    {
      title: '常見問題',
      content: [
        '**Q: 如果 QR Code 無法掃描怎麼辦？**',
        'A: 請確保螢幕亮度足夠，並將 QR Code 完整對準掃描器。如仍無法使用，請立即透過 WhatsApp 6180 8022 聯絡客戶服務。',
        '',
        '**Q: 我可以將 QR Code 分享給朋友使用嗎？**',
        'A: 不可以。每個 QR Code 只對應一個預訂，僅限預訂會員本人使用。',
        '',
        '**Q: QR Code 的有效期是多久？**',
        'A: QR Code 僅在您的預訂時段（包括 10 分鐘提早進場寬限）內有效。',
      ],
    },
  ],
}
