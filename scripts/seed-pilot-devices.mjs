import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'

const devices = [
  { room_code: 'r1', room_display_name: 'Space Infinity', password: process.env.PILOT_R1_PASSWORD },
  { room_code: 'r2', room_display_name: 'Space Eternity', password: process.env.PILOT_R2_PASSWORD },
]

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase service-role environment variables')

  const service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  for (const device of devices) {
    if (!device.password) throw new Error(`Missing password for ${device.room_code}`)
    const password_hash = await bcrypt.hash(device.password, 12)
    const { error } = await service
      .from('pilot_devices')
      .upsert({ room_code: device.room_code, room_display_name: device.room_display_name, password_hash }, { onConflict: 'room_code' })
    if (error) throw new Error(`Failed to seed ${device.room_code}: ${error.message}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Pilot seed failed')
  process.exitCode = 1
})
