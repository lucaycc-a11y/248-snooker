import 'dotenv/config'
import { getBotConfig, getPricing, getVenueConfig } from './database.js'

const BASE_URL = process.env.VECTORENGINE_BASE_URL
const API_KEY = process.env.VECTORENGINE_API_KEY

async function callClaude(body) {
  if (!BASE_URL || !API_KEY) {
    throw new Error('Missing VectorEngine API configuration')
  }

  const response = await fetch(`${BASE_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`VectorEngine request failed with ${response.status}`)
  }

  const data = await response.json()
  return data.content?.[0]?.text || null
}

export async function generateReply(phone, userMessage, context) {
  const { history, bookings } = context

  const [personality, pricing, venue] = await Promise.all([
    getBotConfig('personality'),
    getPricing(),
    getVenueConfig(),
  ])

  const systemPrompt = `${personality || '你係248 Snooker嘅專業客服助手，用繁體廣東話書面語回覆，簡短友善，每次唔超過3句。'}

場地資料（從資料庫讀取，唔可以亂改）：
- 名稱：${venue?.name || '248 Snooker'}
- 開放時間：${venue?.opening_hours || '24小時'}
- 球枱：${venue?.tables || 2}張（枱號#1、枱號#2）
- WhatsApp：+${venue?.whatsapp || '85264274620'}

現時收費（從資料庫讀取）：
${pricing?.rules?.map((rule) => `- ${rule.label}：HK$${rule.price_per_hour}/小時`).join('\n') || '請查詢最新價錢'}

${bookings.length > 0 ? `用戶現有預訂：
${bookings.map((booking) => `- ${booking.date} ${booking.start_time}-${booking.end_time} 枱號#${booking.table_number} ${booking.booking_reference} HK$${booking.total_price} [${booking.status}]`).join('\n')}` : '用戶暫無預訂'}

重要規則：
- 唔確定嘅嘢唔好亂講
- 唔好捏造任何資料
- 驗證碼相關問題叫用戶直接回覆數字
- 預訂問題引導去網站：https://248.formhk.com
- 唔可以幫用戶直接修改預訂，叫佢去網站或聯絡管理員`

  const messages = [
    ...history.map((item) => ({ role: item.role, content: item.content })),
    { role: 'user', content: userMessage },
  ]

  try {
    return await callClaude({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: systemPrompt,
      messages,
    }) || '唔好意思，我暫時無法回覆，請稍後再試。'
  } catch (error) {
    console.error('AI reply failed:', error.message)
    return '唔好意思，我暫時無法回覆，請稍後再試。'
  }
}

export async function generateAdminReply(adminMessage, context) {
  const { history } = context

  const systemPrompt = `你係248 Snooker嘅管理系統AI。
管理員用自然語言同你溝通，你負責理解佢嘅意圖並執行或確認操作。

可以執行嘅操作：
- 更新性格設定 (update_personality)
- 更新價錢 (update_pricing) — 需要確認
- 加入維修日期 (add_maintenance) — 需要確認
- 暫停/恢復自動回覆 (toggle_auto_reply)
- 查看今日統計 (get_stats)
- 測試客服 (test_mode)
- 發送通知畀用戶 (send_notification)

如果操作係改價錢或加維修日，必須先列出更改內容，等管理員回覆「確認」先執行。

回覆格式：
ACTION:action_name
PARAMS:json_params
MESSAGE:顯示畀管理員嘅訊息`

  try {
    return await callClaude({
      model: 'claude-opus-4-8',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        ...history.slice(-10).map((item) => ({ role: item.role, content: item.content })),
        { role: 'user', content: adminMessage },
      ],
    }) || '處理失敗'
  } catch (error) {
    console.error('Admin AI reply failed:', error.message)
    return '處理失敗'
  }
}
