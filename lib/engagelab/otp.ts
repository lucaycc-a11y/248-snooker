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

export function mapEngagelabError(code: number): string {
  const map: Record<number, string> = {
    3004: '請稍後再試，驗證碼發送過於頻繁',
    3005: '帳戶餘額不足，請聯絡管理員',
    3013: '樣板未審批或暫時不可用',
    5011: '電話號碼格式無效',
    5013: '此號碼已被列入黑名單',
    6001: '此電話號碼發送過於頻繁，請稍後再試',
    6003: '今日發送量已達上限',
    6006: '此國家/地區暫不支援發送',
    6007: 'SMS 驗證碼服務暫時暫停，請聯絡管理員',
  }
  return map[code] || '發送失敗，請重試'
}
