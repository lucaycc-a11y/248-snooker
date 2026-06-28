import { isProcessed, saveMessage, getHistory, getUserBookings, getBotConfig } from './database.js'
import { generateReply } from './ai.js'
import { handleAdminMessage } from './admin.js'
import { verifyOTP } from './otp.js'
import { acquireProcessingLock, clearUserState, userStates } from './state.js'
import 'dotenv/config'

const ADMIN_PHONES = (process.env.ADMIN_PHONES || '')
  .split(',')
  .map((phone) => phone.trim())
  .filter(Boolean)

export async function handleMessage(client, msg) {
  if (!msg.body || msg.isStatus || msg.broadcast) return
  if (msg.type !== 'chat') return

  const phone = msg.from.replace('@c.us', '')
  const messageId = msg.id._serialized

  if (await isProcessed(messageId)) return
  if (!acquireProcessingLock(phone)) return

  const autoReply = await getBotConfig('auto_reply')
  if ((autoReply === false || autoReply === 'false') && !ADMIN_PHONES.includes(phone)) {
    return
  }

  if (ADMIN_PHONES.includes(phone)) {
    await handleAdminMessage(client, msg)
    return
  }

  const state = userStates.get(phone) || {}

  if (state.awaitingOTP && /^\d{4}$/.test(msg.body.trim())) {
    const valid = await verifyOTP(phone.replace(/^852/, ''), msg.body.trim())

    if (valid) {
      clearUserState(phone)
      await simulateTyping(client, msg.from, 800)
      await msg.reply('✅ *驗證成功！*\n\n正在為你登入，請返回網頁繼續。')
    } else {
      await msg.reply('❌ 驗證碼錯誤或已過期，請重新發送。')
    }

    await saveMessage(phone, messageId, 'user', msg.body)
    return
  }

  const [history, bookings] = await Promise.all([
    getHistory(phone),
    getUserBookings(phone),
  ])

  await saveMessage(phone, messageId, 'user', msg.body)

  const chat = await msg.getChat()
  await chat.sendStateTyping()

  const reply = await generateReply(phone, msg.body, { history, bookings })
  const typingDelay = Math.min(reply.length * 25, 3000)
  await new Promise((resolve) => setTimeout(resolve, typingDelay))

  await msg.reply(reply)
  await saveMessage(phone, `bot_${messageId}`, 'assistant', reply)
}

async function simulateTyping(client, chatId, ms) {
  try {
    const chat = await client.getChatById(chatId)
    await chat.sendStateTyping()
    await new Promise((resolve) => setTimeout(resolve, ms))
  } catch {
    // Typing simulation is best-effort only.
  }
}
