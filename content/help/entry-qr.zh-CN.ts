import type { HelpArticleContent } from './types'

export const entryQrZhCN: HelpArticleContent = {
  title: '如何使用会员 QR Code 进入场地',
  intro: '完成预订付款后，您将收到一个专属 QR Code，用于进入 Space8 场地。',
  sections: [
    {
      title: '您的 QR Code 在哪里',
      content: [
        '付款成功后，系统会自动将 QR Code 发送至您的注册电邮地址。',
        '您也可随时登入会员账户，在「我的预订」中查看所有有效的 QR Code。',
      ],
    },
    {
      title: '如何使用 QR Code 进场',
      content: [
        '1. 到达 Space8 场地后，在入口处找到 QR Code 扫描器',
        '2. 打开您的 QR Code（可使用手机屏幕显示，或打印纸本）',
        '3. 将 QR Code 对准扫描器',
        '4. 听到「哔」声后，门锁会自动打开',
        '5. 进入场地并开始享受您的预订时段',
      ],
    },
    {
      title: '提早到达或延迟离开的时间宽限',
      content: [
        '为方便会员，Space8 提供以下时间宽限：',
        '• 提早进场：您可在预订开始时间前 10 分钟进场',
        '• 延迟离场：您可在预订结束时间后 10 分钟内离场',
        {
          type: 'callout',
          variant: 'info',
          text: '请注意：这些宽限时间仅供进出场地使用，不会延长您的预订时段本身。',
        },
      ],
    },
    {
      title: '常见问题',
      content: [
        '**Q: 如果 QR Code 无法扫描怎么办？**',
        'A: 请确保屏幕亮度足够，并将 QR Code 完整对准扫描器。如仍无法使用，请立即通过 WhatsApp 6180 8022 联络客户服务。',
        '',
        '**Q: 我可以将 QR Code 分享给朋友使用吗？**',
        'A: 不可以。每个 QR Code 只对应一个预订，仅限预订会员本人使用。',
        '',
        '**Q: QR Code 的有效期是多久？**',
        'A: QR Code 仅在您的预订时段（包括 10 分钟提早进场宽限）内有效。',
      ],
    },
  ],
}
