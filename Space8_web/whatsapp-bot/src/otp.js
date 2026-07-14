import crypto from 'node:crypto'
import { supabase } from './database.js'

function randomDigit() {
  return crypto.randomInt(1, 10)
}

function generateOTP() {
  const patterns = [
    () => {
      const a = randomDigit()
      const b = randomDigit()
      return `${a}${a}${b}${b}`
    },
    () => {
      const a = randomDigit()
      const b = randomDigit()
      return `${a}${b}${b}${a}`
    },
    () => {
      const a = randomDigit()
      const b = randomDigit()
      const c = randomDigit()
      return `${a}${b}${b}${c}`
    },
  ]

  return patterns[crypto.randomInt(0, patterns.length)]()
}

export async function createOTP(phone) {
  const code = generateOTP()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

  await supabase
    .from('whatsapp_otps')
    .update({ used: true })
    .eq('phone', phone)
    .eq('used', false)

  const { error } = await supabase.from('whatsapp_otps').insert({
    phone,
    code,
    expires_at: expiresAt.toISOString(),
  })

  if (error) throw error

  return code
}

export async function verifyOTP(phone, code) {
  const { data, error } = await supabase
    .from('whatsapp_otps')
    .select('*')
    .eq('phone', phone)
    .eq('code', code)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (error || !data) return false

  const { error: updateError } = await supabase
    .from('whatsapp_otps')
    .update({ used: true, verified: true })
    .eq('id', data.id)

  return !updateError
}

export function formatOTPMessage(code) {
  return `*248 Snooker 登入驗證*\n\n` +
    `你的驗證碼是：\n\n` +
    `*${code}*\n\n` +
    `請直接回覆此數字完成驗證。\n` +
    `⏱ 5分鐘內有效\n` +
    `🔒 請勿分享此驗證碼`
}
