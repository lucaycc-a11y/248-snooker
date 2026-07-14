// Stripe decline_code → user-friendly error messages
// https://stripe.com/docs/declines/codes

export type DeclineInfo = {
  message: Record<'zh-HK' | 'zh-CN' | 'en', string>
  canRetry: boolean
  showWhatsApp: boolean
}

export const DECLINE_CODES: Record<string, DeclineInfo> = {
  insufficient_funds: {
    message: {
      'zh-HK': '你的卡餘額不足，請使用其他付款方式',
      'zh-CN': '你的卡余额不足，请使用其他付款方式',
      en: 'Insufficient funds. Please use another payment method.',
    },
    canRetry: true,
    showWhatsApp: false,
  },
  expired_card: {
    message: {
      'zh-HK': '你的卡已過期，請使用其他卡',
      'zh-CN': '你的卡已过期，请使用其他卡',
      en: 'Your card has expired. Please use another card.',
    },
    canRetry: true,
    showWhatsApp: false,
  },
  incorrect_cvc: {
    message: {
      'zh-HK': 'CVC 安全碼不正確，請重新輸入',
      'zh-CN': 'CVC 安全码不正确，请重新输入',
      en: 'Incorrect CVC security code. Please re-enter.',
    },
    canRetry: true,
    showWhatsApp: false,
  },
  card_declined: {
    message: {
      'zh-HK': '你的卡被銀行拒絕，請聯絡發卡銀行或使用其他付款方式',
      'zh-CN': '你的卡被银行拒绝，请联络发卡银行或使用其他付款方式',
      en: 'Your card was declined by the bank. Please contact your bank or use another payment method.',
    },
    canRetry: true,
    showWhatsApp: false,
  },
  fraudulent: {
    message: {
      'zh-HK': '此付款因安全理由被拒絕，請使用其他付款方式或聯絡我們',
      'zh-CN': '此付款因安全理由被拒绝，请使用其他付款方式或联络我们',
      en: 'This payment was declined for security reasons. Please use another payment method or contact us.',
    },
    canRetry: true,
    showWhatsApp: true,
  },
  do_not_honor: {
    message: {
      'zh-HK': '你的銀行拒絕了此次付款，請聯絡銀行了解詳情',
      'zh-CN': '你的银行拒绝了此次付款，请联络银行了解详情',
      en: 'Your bank declined this payment. Please contact your bank for details.',
    },
    canRetry: true,
    showWhatsApp: false,
  },
  processing_error: {
    message: {
      'zh-HK': '付款處理時出錯，請重試',
      'zh-CN': '付款处理时出错，请重试',
      en: 'A processing error occurred. Please try again.',
    },
    canRetry: true,
    showWhatsApp: true,
  },
}

export function getDeclineMessage(
  declineCode: string | undefined,
  locale: 'zh-HK' | 'zh-CN' | 'en',
  fallback: string
): { message: string; canRetry: boolean; showWhatsApp: boolean } {
  if (!declineCode || !DECLINE_CODES[declineCode]) {
    return {
      message: fallback,
      canRetry: true,
      showWhatsApp: true, // Unknown errors might be double-charge concerns
    }
  }

  const info = DECLINE_CODES[declineCode]
  return {
    message: info.message[locale],
    canRetry: info.canRetry,
    showWhatsApp: info.showWhatsApp,
  }
}

export function getWhatsAppSupportUrl(params: {
  locale: 'zh-HK' | 'zh-CN' | 'en'
  date: string
  time: string
  amount: number
}): string {
  const messages = {
    'zh-HK': `我在 Space8 預訂時可能已被扣款但未收到確認，時段：${params.date} ${params.time}，金額：HK$${params.amount}`,
    'zh-CN': `我在 Space8 预订时可能已被扣款但未收到确认，时段：${params.date} ${params.time}，金额：HK$${params.amount}`,
    en: `I may have been charged for a Space8 booking but didn't receive confirmation. Time: ${params.date} ${params.time}, Amount: HK$${params.amount}`,
  }

  // Same WhatsApp business number as the Footer's contact link
  // (components/layout/Footer.tsx) — keep these in sync.
  const whatsappNumber = '85264274620'
  const message = encodeURIComponent(messages[params.locale])
  return `https://wa.me/${whatsappNumber}?text=${message}`
}
