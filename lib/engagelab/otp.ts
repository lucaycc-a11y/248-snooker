export interface EngagelabOtpResponse {
  message_id: string
  send_channel: 'whatsapp' | 'sms' | string
  code?: number
  message?: string
}

export async function sendEngagelabOtp(phone: string, language: string = 'zh_HK'): Promise<EngagelabOtpResponse> {
  const authBase64 = process.env.ENGAGELAB_AUTH_BASE64
  const templateId = process.env.ENGAGELAB_OTP_TEMPLATE_ID

  if (!authBase64 || !templateId) {
    throw new Error('Engagelab configuration missing')
  }

  const res = await fetch('https://otp.api.engagelab.cc/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${authBase64}`,
    },
    body: JSON.stringify({
      to: phone,
      template: {
        id: templateId,
        language,
      },
    }),
  })

  const data = await res.json()

  if (!res.ok) {
    throw {
      code: data.code,
      message: data.message,
      httpStatus: res.status,
    }
  }

  return data
}

export interface EngagelabVerifyResponse {
  verified?: boolean
  code?: number
  message?: string
}

export async function verifyEngagelabOtp(messageId: string, code: string): Promise<EngagelabVerifyResponse> {
  const authBase64 = process.env.ENGAGELAB_AUTH_BASE64
  if (!authBase64) {
    throw new Error('Engagelab configuration missing')
  }

  const res = await fetch('https://otp.api.engagelab.cc/v1/verifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${authBase64}`,
    },
    body: JSON.stringify({
      message_id: messageId,
      verify_code: code,
    }),
  })

  const data = await res.json()

  if (!res.ok) {
    throw {
      code: data.code,
      message: data.message,
      httpStatus: res.status,
    }
  }

  return data
}

export interface EngagelabErrorInfo {
  code: number
  type: 'otp_pending' | 'rate_limited' | 'generic'
  message: string
  userMessage: string
}

export function mapEngagelabError(code: number): EngagelabErrorInfo {
  const errorMap: Record<number, Omit<EngagelabErrorInfo, 'code'>> = {
    3004: {
      type: 'otp_pending',
      message: 'OTP still valid - same template + phone within expiry period',
      userMessage: '你有一個未過期的驗證碼，請直接輸入或等待現有驗證碼失效',
    },
    6001: {
      type: 'rate_limited',
      message: 'Phone number send frequency exceeded',
      userMessage: '此電話號碼發送過於頻繁，請稍後再試',
    },
    3005: {
      type: 'generic',
      message: 'Account balance insufficient',
      userMessage: '帳戶餘額不足，請聯絡管理員',
    },
    3013: {
      type: 'generic',
      message: 'Template not approved or unavailable',
      userMessage: '樣板未審批或暫時不可用',
    },
    5011: {
      type: 'generic',
      message: 'Invalid phone number format',
      userMessage: '電話號碼格式無效',
    },
    5013: {
      type: 'generic',
      message: 'Phone number blacklisted',
      userMessage: '此號碼已被列入黑名單',
    },
    6003: {
      type: 'generic',
      message: 'Daily send limit reached',
      userMessage: '今日發送量已達上限',
    },
    6006: {
      type: 'generic',
      message: 'Country/region not supported',
      userMessage: '此國家/地區暫不支援發送',
    },
    6007: {
      type: 'generic',
      message: 'SMS verification service suspended',
      userMessage: 'SMS 驗證碼服務暫時暫停，請聯絡管理員',
    },
  }

  const mapped = errorMap[code]
  if (!mapped) {
    return {
      code,
      type: 'generic',
      message: 'Unknown Engagelab error',
      userMessage: '發送失敗，請重試',
    }
  }

  return { code, ...mapped }
}
