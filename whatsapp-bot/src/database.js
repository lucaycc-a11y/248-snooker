import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const requiredEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']
for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
)

export async function getHistory(phone, limit = 20) {
  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .select('role, content, created_at')
    .eq('phone', phone)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Failed to load WhatsApp history:', error.message)
    return []
  }

  return (data || []).reverse()
}

export async function saveMessage(phone, messageId, role, content) {
  const { error } = await supabase.from('whatsapp_conversations').upsert(
    {
      phone,
      message_id: messageId,
      role,
      content,
    },
    { onConflict: 'message_id', ignoreDuplicates: true }
  )

  if (error) {
    console.error('Failed to save WhatsApp message:', error.message)
  }
}

export async function isProcessed(messageId) {
  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('message_id', messageId)
    .maybeSingle()

  if (error) {
    console.error('Failed to check message dedupe:', error.message)
    return false
  }

  return Boolean(data)
}

export async function getUserBookings(phone) {
  const cleanPhone = phone.replace('@c.us', '').replace(/^852/, '')
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id, date, start_time, end_time,
      duration_hours, total_price, status,
      table_number, booking_reference,
      payment_method, is_free_booking
    `)
    .eq('user_phone', cleanPhone)
    .in('status', ['confirmed', 'pending'])
    .order('date', { ascending: true })
    .limit(5)

  if (error) {
    console.error('Failed to load user bookings:', error.message)
    return []
  }

  return data || []
}

export async function getPricing() {
  const { data, error } = await supabase
    .from('config')
    .select('value')
    .eq('key', 'pricing')
    .maybeSingle()

  if (error) {
    console.error('Failed to load pricing config:', error.message)
    return null
  }

  return data?.value || null
}

export async function getVenueConfig() {
  const { data, error } = await supabase
    .from('config')
    .select('value')
    .eq('key', 'venue')
    .maybeSingle()

  if (error) {
    console.error('Failed to load venue config:', error.message)
    return null
  }

  return data?.value || null
}

export async function getBotConfig(key) {
  const { data, error } = await supabase
    .from('bot_config')
    .select('value')
    .eq('key', key)
    .maybeSingle()

  if (error) {
    console.error(`Failed to load bot config ${key}:`, error.message)
    return null
  }

  return data?.value ?? null
}

export async function updateBotConfig(key, value) {
  const { error } = await supabase.from('bot_config').upsert(
    {
      key,
      value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  )

  if (error) throw error
}

export async function updatePricing(rules) {
  const { error } = await supabase
    .from('config')
    .update({
      value: rules,
      updated_at: new Date().toISOString(),
    })
    .eq('key', 'pricing')

  if (error) throw error
}

// Admin phones stored in bot_config so they can be managed via WhatsApp commands
export async function getAdminPhones() {
  const { data } = await supabase
    .from('bot_config')
    .select('value')
    .eq('key', 'admin_phones')
    .maybeSingle()
  return Array.isArray(data?.value) ? data.value : []
}

export async function addAdminPhone(phone) {
  const current = await getAdminPhones()
  if (current.includes(phone)) return
  const updated = [...current, phone]
  await supabase.from('bot_config').upsert(
    { key: 'admin_phones', value: updated, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
}

export async function removeAdminPhone(phone) {
  const current = await getAdminPhones()
  const updated = current.filter((p) => p !== phone)
  await supabase.from('bot_config').upsert(
    { key: 'admin_phones', value: updated, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
}

export { supabase }
