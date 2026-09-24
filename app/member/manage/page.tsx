'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { PersonalInfoTab } from './tabs/PersonalInfoTab'
import { SecurityTab } from './tabs/SecurityTab'
import { PrivacyDataTab } from './tabs/PrivacyDataTab'

// ════════════════════════════════════════════════════════════════════════════
// Manage Account — Tabs: Home / Personal Info / Security / Privacy & Data
// ════════════════════════════════════════════════════════════════════════════

type Tab = 'home' | 'personal' | 'security' | 'privacy'

export default function ManageAccountPage() {
  const router = useRouter()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<Tab>('home')
  const [profile, setProfile] = useState<{
    display_name: string | null
    email: string | null
    phone: string | null
    gender: string | null
    birthday: string | null
    birthday_set: boolean
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/auth/login')
      return
    }

    const { data } = await supabase
      .from('users')
      .select('display_name, email, phone, gender, birthday, birthday_set')
      .eq('id', session.user.id)
      .single()

    if (data) {
      setProfile(data)
    }
    setLoading(false)
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
            <h1 className="text-lg font-medium text-white">Manage Account</h1>
            <div className="w-6" />
          </div>
        </div>

        {/* Tab Bar */}
        <div className="border-t border-white/5">
          <div className="mx-auto max-w-3xl px-4">
            <div className="flex gap-6">
              <TabButton
                label="Home"
                active={activeTab === 'home'}
                onClick={() => setActiveTab('home')}
              />
              <TabButton
                label="Personal Info"
                active={activeTab === 'personal'}
                onClick={() => setActiveTab('personal')}
              />
              <TabButton
                label="Security"
                active={activeTab === 'security'}
                onClick={() => setActiveTab('security')}
              />
              <TabButton
                label="Privacy & Data"
                active={activeTab === 'privacy'}
                onClick={() => setActiveTab('privacy')}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6">
        {activeTab === 'home' && <HomeTab profile={profile} />}
        {activeTab === 'personal' && <PersonalInfoTab profile={profile} onUpdate={loadProfile} />}
        {activeTab === 'security' && <SecurityTab />}
        {activeTab === 'privacy' && <PrivacyDataTab />}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § TAB BUTTON
// ────────────────────────────────────────────────────────────────────────────

type TabButtonProps = {
  label: string
  active: boolean
  onClick: () => void
}

function TabButton({ label, active, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className="relative py-4 text-sm font-medium transition-colors"
    >
      <span className={active ? 'text-white' : 'text-white/50'}>{label}</span>
      {active && (
        <motion.div
          layoutId="activeTab"
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#22c55e]"
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      )}
    </button>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § HOME TAB
// ────────────────────────────────────────────────────────────────────────────

function HomeTab({ profile }: { profile: any }) {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6">
        <h2 className="mb-4 text-lg font-bold text-white">帳戶概覽</h2>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-white/50">姓名</span>
            <span className="text-white">{profile?.display_name ?? '未設定'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">電郵</span>
            <span className="text-white">{profile?.email ?? '未設定'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">電話</span>
            <span className="text-white">{profile?.phone ?? '未設定'}</span>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <a
          href="/member/manage?tab=personal"
          className="block rounded-xl border border-white/10 bg-gradient-to-r from-white/5 to-transparent p-4 transition-all hover:border-white/20 hover:from-white/10"
        >
          <p className="font-medium text-white">Personal Info</p>
          <p className="text-xs text-white/50">更新個人資料</p>
        </a>
        <a
          href="/member/manage?tab=security"
          className="block rounded-xl border border-white/10 bg-gradient-to-r from-white/5 to-transparent p-4 transition-all hover:border-white/20 hover:from-white/10"
        >
          <p className="font-medium text-white">Security</p>
          <p className="text-xs text-white/50">密碼及登入設定</p>
        </a>
        <a
          href="/member/manage?tab=privacy"
          className="block rounded-xl border border-white/10 bg-gradient-to-r from-white/5 to-transparent p-4 transition-all hover:border-white/20 hover:from-white/10"
        >
          <p className="font-medium text-white">Privacy & Data</p>
          <p className="text-xs text-white/50">私隱及資料管理</p>
        </a>
      </section>
    </div>
  )
}
