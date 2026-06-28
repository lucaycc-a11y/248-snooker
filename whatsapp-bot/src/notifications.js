export async function sendBookingConfirmation(client, phone, booking) {
  const msg =
    `✅ *預訂確認*\n\n` +
    `📅 ${booking.date}\n` +
    `🕐 ${booking.start_time} – ${booking.end_time}\n` +
    `🎱 枱號 #${booking.table_number}\n` +
    `💰 HK$${booking.total_price}\n` +
    `🔖 ${booking.booking_reference}\n\n` +
    `請於入場時出示預訂確認QR碼。\n` +
    `如需更改請到：https://248.formhk.com`

  await client.sendMessage(formatWhatsAppId(phone), msg)
}

export async function sendReminder(client, phone, booking, minutesBefore) {
  const msg = minutesBefore === 15
    ? `⏰ *提醒* 你的時段將於 *15分鐘後* 開始\n\n` +
      `🕐 ${booking.start_time} – ${booking.end_time}\n` +
      `🎱 枱號 #${booking.table_number}\n\n` +
      `請準時到場，祝你玩得開心！ 🎱`
    : `⏰ *提醒* 你的時段將於 *30分鐘後* 開始\n\n` +
      `🕐 ${booking.start_time}\n` +
      `🎱 248 Snooker 枱號 #${booking.table_number}`

  await client.sendMessage(formatWhatsAppId(phone), msg)
}

export async function sendSessionEnding(client, phone, booking) {
  const msg =
    `🔔 *時段完結提醒*\n\n` +
    `你的時段（${booking.start_time} – ${booking.end_time}）已完結。\n` +
    `如需延長，請即到網站預訂下一個時段：\n` +
    `https://248.formhk.com\n\n` +
    `多謝光臨 248 Snooker！🎱`

  await client.sendMessage(formatWhatsAppId(phone), msg)
}

export async function sendAdminNewBooking(client, adminPhones, booking) {
  const msg =
    `🆕 *新預訂*\n\n` +
    `📅 ${booking.date}\n` +
    `🕐 ${booking.start_time} – ${booking.end_time}\n` +
    `🎱 枱號 #${booking.table_number}\n` +
    `💰 HK$${booking.total_price}\n` +
    `🔖 ${booking.booking_reference}\n` +
    `📱 ${booking.user_phone || '未知'}\n` +
    `💳 ${booking.payment_method}`

  for (const adminPhone of adminPhones) {
    await client.sendMessage(formatWhatsAppId(adminPhone), msg)
  }
}

function formatWhatsAppId(phone) {
  const digits = String(phone).replace(/\D/g, '')
  const fullPhone = digits.startsWith('852') ? digits : `852${digits}`
  return `${fullPhone}@c.us`
}
