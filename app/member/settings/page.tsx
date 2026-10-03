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

          {/* Delete Account */}
          <DeleteAccountSection email={profile?.email} />
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § DELETE ACCOUNT SECTION
// ────────────────────────────────────────────────────────────────────────────

type DeleteAccountProps = {
  email: string | null | undefined
}

function DeleteAccountSection({ email }: DeleteAccountProps) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [step, setStep] = useState<'confirm' | 'verify' | 'processing'>('confirm')
  const [verificationCode, setVerificationCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleConfirm = () => {
    setStep('verify')
    setError(null)
  }

  const handleVerify = async () => {
    if (!verificationCode.trim()) {
      setError('請輸入驗證碼')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/member/delete-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationCode }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.message || '刪除失敗，請稍後重試')
        setLoading(false)
        return
      }

      setStep('processing')
      // User will be signed out by backend; redirect after brief delay
      setTimeout(() => {
        router.push('/auth/login?deleted=true')
      }, 2000)
    } catch (err) {
      setError('發生錯誤，請稍後重試')
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setShowModal(true)
          setStep('confirm')
          setError(null)
          setVerificationCode('')
        }}
        className="w-full rounded-xl border border-red-500/40 bg-gradient-to-r from-red-500/10 to-transparent p-4 text-center font-medium text-red-400 transition-all hover:border-red-500/60 hover:from-red-500/20"
      >
        刪除帳戶
      </button>

      {showModal && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative max-w-md rounded-2xl border border-white/10 bg-gradient-to-br from-[#1A1F2E] to-[#0F131C] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
          >
            {/* Close button */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute right-4 top-4 text-white/40 hover:text-white/60"
            >
              ✕
            </button>

            {/* Step 1: Confirmation */}
            {step === 'confirm' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <h2 className="text-lg font-bold text-white">確認刪除帳戶</h2>
                <div className="space-y-3 rounded-lg bg-red-500/5 p-3 text-sm text-red-300">
                  <p>⚠️ 此操作不可逆轉。刪除帳戶將：</p>
                  <ul className="list-inside space-y-1 pl-2">
                    <li>• 永久刪除您的帳戶和個人資料</li>
                    <li>• 保留歷史預訂記錄（法律要求）</li>
                    <li>• 取消所有未完成預訂</li>
                    <li>• 刪除所有積分和優惠券</li>
                  </ul>
                </div>
                <p className="text-sm text-white/60">已激活的預訂必須先取消。</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 py-2 text-white transition-all hover:bg-white/10"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex-1 rounded-lg bg-red-600 py-2 font-medium text-white transition-all hover:bg-red-700"
                  >
                    繼續
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 2: Verification */}
            {step === 'verify' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <h2 className="text-lg font-bold text-white">驗證您的身份</h2>
                <p className="text-sm text-white/60">
                  驗證碼已發送至 <strong className="text-white">{email}</strong>
                </p>
                <input
                  type="text"
                  placeholder="輸入驗證碼"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-red-500 focus:outline-none"
                  disabled={loading}
                />
                {error && <p className="text-sm text-red-400">{error}</p>}
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('confirm')}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 py-2 text-white transition-all hover:bg-white/10"
                    disabled={loading}
                  >
                    返回
                  </button>
                  <button
                    onClick={handleVerify}
                    disabled={loading || !verificationCode.trim()}
                    className="flex-1 rounded-lg bg-red-600 py-2 font-medium text-white transition-all hover:bg-red-700 disabled:opacity-50"
                  >
                    {loading ? '處理中...' : '確認刪除'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Processing */}
            {step === 'processing' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4 text-center"
              >
                <motion.div
                  className="mx-auto h-12 w-12 rounded-full border-2 border-green-500/30 border-t-green-500"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
                <h2 className="text-lg font-bold text-white">處理中...</h2>
                <p className="text-sm text-white/60">正在刪除您的帳戶。您將被重新導向至登入頁面。</p>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </>
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
