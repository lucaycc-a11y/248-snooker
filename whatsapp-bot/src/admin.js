import { generateAdminReply } from './ai.js'
import {
  updateBotConfig,
  updatePricing,
  getHistory,
  saveMessage,
  supabase,
} from './database.js'

const pendingConfirmations = new Map()

export async function handleAdminMessage(client, msg) {
  const phone = msg.from.replace('@c.us', '')
  const text = msg.body.trim()

  if (pendingConfirmations.has(phone)) {
    const pending = pendingConfirmations.get(phone)

    if (text === '確認' || text.toLowerCase() === 'confirm') {
      pendingConfirmations.delete(phone)
      await executePendingAction(msg, pending)
      return
    }

    if (text === '取消' || text.toLowerCase() === 'cancel') {
      pendingConfirmations.delete(phone)
      await msg.reply('已取消操作。')
      return
    }
  }

  const history = await getHistory(phone, 10)
  const aiResponse = await generateAdminReply(text, { history })
  const { action, params, message } = parseAdminResponse(aiResponse)

  if (['update_pricing', 'add_maintenance'].includes(action)) {
    pendingConfirmations.set(phone, { action, params })
    await msg.reply(`${message}\n\n回覆 *確認* 執行，或 *取消* 放棄。`)
    return
  }

  if (action) {
    await executeAction(msg, action, params)
  }

  await msg.reply(message)
  await saveMessage(phone, `admin_${Date.now()}`, 'user', text)
  await saveMessage(phone, `bot_${Date.now()}`, 'assistant', message)
}

function parseAdminResponse(aiResponse) {
  const actionMatch = aiResponse.match(/ACTION:(\w+)/)
  const paramsMatch = aiResponse.match(/PARAMS:(.+?)(?:\nMESSAGE:|$)/s)
  const messageMatch = aiResponse.match(/MESSAGE:([\s\S]+)$/)

  let params = null
  if (paramsMatch?.[1]) {
    try {
      params = JSON.parse(paramsMatch[1].trim())
    } catch {
      params = null
    }
  }

  return {
    action: actionMatch?.[1],
    params,
    message: messageMatch?.[1]?.trim() || aiResponse,
  }
}

async function executeAction(msg, action, params) {
  switch (action) {
    case 'update_personality':
      if (params?.personality) await updateBotConfig('personality', params.personality)
      break

    case 'toggle_auto_reply':
      await updateBotConfig('auto_reply', Boolean(params?.enabled))
      break

    case 'get_stats': {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('bookings')
        .select('total_price, status, table_number')
        .eq('date', today)
        .eq('status', 'confirmed')

      const total = data?.reduce((sum, booking) => sum + booking.total_price, 0) || 0
      const count = data?.length || 0
      await msg.reply(
        `📊 *今日統計 (${today})*\n\n` +
        `預訂數量：${count}\n` +
        `今日收入：HK$${total}\n` +
        `枱號#1：${data?.filter((booking) => booking.table_number === 1).length || 0}個\n` +
        `枱號#2：${data?.filter((booking) => booking.table_number === 2).length || 0}個`
      )
      break
    }
  }
}

async function executePendingAction(msg, pending) {
  const { action, params } = pending

  if (action === 'update_pricing') {
    await updatePricing(params)
    await msg.reply('✅ 價錢已更新。')
    return
  }

  if (action === 'add_maintenance') {
    const { data } = await supabase
      .from('config')
      .select('value')
      .eq('key', 'maintenance')
      .maybeSingle()

    const current = data?.value || { dates: [] }
    current.dates.push(params.date)

    await supabase
      .from('config')
      .update({ value: current, updated_at: new Date().toISOString() })
      .eq('key', 'maintenance')

    await msg.reply(`✅ 已加入維修日期：${params.date}`)
  }
}
