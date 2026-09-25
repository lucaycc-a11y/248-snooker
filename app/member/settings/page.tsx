'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// ════════════════════════════════════════════════════════════════════════════
// Settings Page — Name, phone (RO), email (RO), notifications, language, sign out
// Changes to phone/email go through existing auth flows (email link + OTP)
// ════════════════════════════════════════════════════════════════════════════

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<{
    display_name: string | null
    phone: string | null
    email: string | null
  } | null>(null)

  const [notifPrefs, setNotifPrefs] = useState({
    booking_reminders: true,
    points_updates: true,
    offers: true,
  })

  const [locale, setLocale] = useState('zh-HK')

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    // SECURITY: Use getUser() not getSession() for client-side auth checks
    // getSession() reads cookies which can be forged; getUser() validates with auth server
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      router.push('/auth/login')
      return
    }

    // Query only columns that exist in users table schema
    // (notification_preferences and preferred_locale don't exist in the schema)
    const { data, error: profileError } = await supabase
      .from('users')
      .select('display_name, phone, email')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('[Settings] Profile fetch failed:', profileError.message)
    }

    if (data) {
      setProfile(data)
    }
    setLoading(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleSignOutAllDevices = async () => {
    // Sign out globally (invalidates all sessions)
    await supabase.auth.signOut({ scope: 'global' })
    router.push('/')
  }

  const handleNotifToggle = async (key: keyof typeof notifPrefs) => {
    const newPrefs = { ...notifPrefs, [key]: !notifPrefs[key] }
    setNotifPrefs(newPrefs)

    // Note: notification_preferences column doesn't exist in users table schema
    // This is client-side state only until the column is added
    console.warn('[Settings] notification_preferences column does not exist in users table')
  }

  const handleLocaleChange = async (newLocale: string) => {
    setLocale(newLocale)

    // Note: preferred_locale column doesn't exist in users table schema
    // This is client-side state only until the column is added
    console.warn('[Settings] preferred_locale column does not exist in users table')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#05070C] via-[#0A0D12] to-[#0F131C]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05070C] via-[#0A0D12] to-[#0F131C]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0A0D12]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="flex items-center justify-between">
            <a href="/member" className="text-white/60 transition-colors hover:text-white">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </a>
            <h1 className="text-lg font-medium text-white">Settings</h1>
            <div className="w-6" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="space-y-6">
          {/* Profile Section */}
          <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6">
            <h2 className="mb-4 text-lg font-bold text-white">個人資料</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-white/50">姓名</label>
                <p className="mt-1 text-white">{profile?.display_name ?? '未設定'}</p>
              </div>
              <div>
                <label className="text-sm text-white/50">電話 (只讀)</label>
                <p className="mt-1 text-white">{profile?.phone ?? '未設定'}</p>
                <a href="/auth/change-phone" className="mt-1 text-xs text-[#22c55e] underline">
                  更改電話
                </a>
              </div>
              <div>
                <label className="text-sm text-white/50">電郵 (只讀)</label>
                <p className="mt-1 text-white">{profile?.email ?? '未設定'}</p>
                <a href="/auth/change-email" className="mt-1 text-xs text-[#22c55e] underline">
                  更改電郵
                </a>
              </div>
            </div>
          </section>

          {/* App Settings */}
          <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6">
            <h2 className="mb-4 text-lg font-bold text-white">應用程式設定</h2>
            <div className="space-y-4">
              <ToggleRow
                label="預訂提醒"
                checked={notifPrefs.booking_reminders}
                onChange={() => handleNotifToggle('booking_reminders')}
              />
              <ToggleRow
                label="積分更新"
                checked={notifPrefs.points_updates}
                onChange={() => handleNotifToggle('points_updates')}
              />
              <ToggleRow
                label="優惠資訊"
                checked={notifPrefs.offers}
                onChange={() => handleNotifToggle('offers')}
              />
              <div className="border-t border-white/10 pt-4">
                <label className="text-sm text-white/50">語言</label>
                <select
                  value={locale}
                  onChange={(e) => handleLocaleChange(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-[#22c55e] focus:outline-none"
                >
                  <option value="zh-HK">繁體中文</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
          </section>

          {/* Sign Out */}
          <section className="space-y-3">
            <button
              onClick={handleSignOut}
              className="w-full rounded-xl border border-white/10 bg-gradient-to-r from-white/5 to-transparent p-4 text-center font-medium text-white transition-all hover:border-white/20 hover:from-white/10"
            >
              登出
            </button>
            <button
              onClick={handleSignOutAllDevices}
              className="w-full rounded-xl border border-red-500/20 bg-gradient-to-r from-red-500/5 to-transparent p-4 text-center text-sm text-red-400 transition-all hover:border-red-500/40 hover:from-red-500/10"
            >
              登出所有其他裝置
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § TOGGLE ROW
// ────────────────────────────────────────────────────────────────────────────

type ToggleRowProps = {
  label: string
  checked: boolean
  onChange: () => void
}

function ToggleRow({ label, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-white">{label}</span>
      <button
        onClick={onChange}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? 'bg-[#22c55e]' : 'bg-white/20'
        }`}
      >
        <motion.div
          className="absolute top-1 h-4 w-4 rounded-full bg-white"
          animate={{ left: checked ? 24 : 4 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  )
}
