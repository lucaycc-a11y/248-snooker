// Stripe decline_code → user-friendly error messages
// https://stripe.com/docs/declines/codes

export type DeclineInfo = {
  message: Record<'zh-HK' | 'zh-CN' | 'en' | 'ja', string>
  canRetry: boolean
  showWhatsApp: boolean
}

export const DECLINE_CODES: Record<string, DeclineInfo> = {
  insufficient_funds: {
    message: {
      'zh-HK': '你嘅卡餘額不足，請使用其他付款方式',
      'zh-CN': '你的卡余额不足，请使用其他付款方式',
      en: 'Insufficient funds. Please use another payment method.',
      ja: 'カード残高が不足しています。別の支払い方法をご利用ください。',
    },
    canRetry: true,
    showWhatsApp: false,
  },
  expired_card: {
    message: {
      'zh-HK': '你嘅卡已過期，請使用其他卡',
      'zh-CN': '你的卡已过期，请使用其他卡',
      en: 'Your card has expired. Please use another card.',
      ja: 'カードの有効期限が切れています。別のカードをご利用ください。',
    },
    canRetry: true,
    showWhatsApp: false,
  },
  incorrect_cvc: {
    message: {
      'zh-HK': 'CVC 安全碼不正確，請重新輸入',
      'zh-CN': 'CVC 安全码不正确，请重新输入',
      en: 'Incorrect CVC security code. Please re-enter.',
      ja: 'CVCセキュリティコードが正しくありません。再入力してください。',
    },
    canRetry: true,
    showWhatsApp: false,
  },
  card_declined: {
    message: {
      'zh-HK': '你嘅卡被銀行拒絕，請聯絡發卡銀行或使用其他付款方式',
      'zh-CN': '你的卡被银行拒绝，请联络发卡银行或使用其他付款方式',
      en: 'Your card was declined by the bank. Please contact your bank or use another payment method.',
      ja: 'カードが銀行によって拒否されました。銀行にお問い合わせいただくか、別の支払い方法をご利用ください。',
    },
    canRetry: true,
    showWhatsApp: false,
  },
  fraudulent: {
    message: {
      'zh-HK': '此付款因安全理由被拒絕，請使用其他付款方式或聯絡我們',
      'zh-CN': '此付款因安全理由被拒绝，请使用其他付款方式或联络我们',
      en: 'This payment was declined for security reasons. Please use another payment method or contact us.',
      ja: 'このお支払いはセキュリティ上の理由で拒否されました。別の支払い方法をご利用いただくか、お問い合わせください。',
    },
    canRetry: true,
    showWhatsApp: true,
  },
  do_not_honor: {
    message: {
      'zh-HK': '你嘅銀行拒絕咗呢次付款，請聯絡銀行了解詳情',
      'zh-CN': '你的银行拒绝了此次付款，请联络银行了解详情',
      en: 'Your bank declined this payment. Please contact your bank for details.',
      ja: '銀行がこの支払いを拒否しました。詳細については銀行にお問い合わせください。',
    },
    canRetry: true,
    showWhatsApp: false,
  },
  processing_error: {
    message: {
      'zh-HK': '付款處理時出錯，請重試',
      'zh-CN': '付款处理时出错，请重试',
      en: 'A processing error occurred. Please try again.',
      ja: '処理エラーが発生しました。再度お試しください。',
    },
    canRetry: true,
    showWhatsApp: true,
  },
}

export function getDeclineMessage(
  declineCode: string | undefined,
  locale: 'zh-HK' | 'zh-CN' | 'en' | 'ja',
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
  locale: 'zh-HK' | 'zh-CN' | 'en' | 'ja'
  date: string
  time: string
  amount: number
}): string {
  const messages = {
    'zh-HK': `我喺 248 Snooker 訂位時可能已被扣款但未收到確認，時段：${params.date} ${params.time}，金額：HK$${params.amount}`,
    'zh-CN': `我在 248 Snooker 订位时可能已被扣款但未收到确认，时段：${params.date} ${params.time}，金额：HK$${params.amount}`,
    en: `I may have been charged for a 248 Snooker booking but didn't receive confirmation. Time: ${params.date} ${params.time}, Amount: HK$${params.amount}`,
    ja: `248 Snookerの予約で支払いが発生しましたが、確認が届いていません。時間：${params.date} ${params.time}、金額：HK$${params.amount}`,
  }

  // TODO: Replace with actual WhatsApp business number
  const whatsappNumber = '85212345678'
  const message = encodeURIComponent(messages[params.locale])
  return `https://wa.me/${whatsappNumber}?text=${message}`
}
