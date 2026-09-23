import type { HelpArticleContent } from './types'

export const findQrZhCN: HelpArticleContent = {
  title: '如何找回您的 QR Code',
  intro: '如果您遗失了预订的 QR Code，可以通过以下方法重新取得。',
  sections: [
    {
      title: '通过会员账户查看',
      content: [
        '1. 登入您的 Space8 会员账户',
        '2. 进入「我的预订」页面',
        '3. 找到相关预订',
        '4. 点击「查看 QR Code」',
        '5. QR Code 会立即显示在屏幕上',
        {
          type: 'callout',
          variant: 'info',
          text: '您可以将 QR Code 截图保存，或直接在手机上显示使用。',
        },
      ],
    },
    {
      title: '重新发送至电邮',
      content: [
        '如果您无法登入账户，可以要求系统重新发送 QR Code：',
        '',
        '1. 在登入页面选择「需要协助？」',
        '2. 选择「重新发送 QR Code」',
        '3. 输入您的预订编号和注册电邮',
        '4. 系统会将 QR Code 重新发送至您的电邮',
        '',
        '预订编号格式：SPACE8-XXXXX-C（可在原始预订确认电邮中找到）',
      ],
    },
    {
      title: '联络客户服务',
      content: [
        '如果以上方法仍无法取得 QR Code，请立即联络我们：',
        '',
        '**WhatsApp: 6180 8022**',
        '请提供以下资料：',
        '• 预订编号（格式：SPACE8-XXXXX-C）',
        '• 注册电邮地址',
        '• 预订日期和时段',
        '',
        '**电邮: Admin@space8.com.hk**',
        '我们会在收到您的讯息后尽快协助您重新发送 QR Code。',
      ],
    },
    {
      title: '预防措施',
      content: [
        '为避免找不到 QR Code 的情况，建议您：',
        '• 收到 QR Code 后立即截图保存',
        '• 将预订确认电邮标记为重要邮件',
        '• 在预订当天提前检查 QR Code 是否可用',
        '• 确保您的会员账户登入资料安全保存',
      ],
    },
  ],
}
