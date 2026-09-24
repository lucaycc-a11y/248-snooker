'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'

// ════════════════════════════════════════════════════════════════════════════
// Security Tab — Password, OAuth (Google + Apple), Login Activity (stub)
// ════════════════════════════════════════════════════════════════════════════

type Identity = {
  id: string
  user_id: string
  identity_id: string
  provider: string
}

export function SecurityTab() {
  const supabase = createClient()
  const [identities, setIdentities] = useState<Identity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadConnectedProviders()
  }, [])

  const loadConnectedProviders = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    // Get user's linked identities
    const { data: { user } } = await supabase.auth.getUser()
    const userIdentities = (user?.identities ?? []) as Identity[]

    setIdentities(userIdentities)
    setLoading(false)
  }

  const handleDisconnect = async (identity: Identity) => {
    const providerName = identity.provider === 'google' ? 'Google' : 'Apple'
    const confirmed = confirm(`確定要取消連接 ${providerName} 帳戶？`)
    if (!confirmed) return

    const { error } = await supabase.auth.unlinkIdentity(identity)
    if (!error) {
      setIdentities(identities.filter((i) => i.id !== identity.id))
    }
  }

  return (
    <div className="space-y-6">
      {/* Password */}
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6">
        <h2 className="mb-4 text-lg font-bold text-white">密碼</h2>
        <a
          href="/auth/change-password"
          className="block rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white transition-colors hover:bg-white/10"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm">更改密碼</span>
            <svg className="h-5 w-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </a>
      </section>

      {/* Connected Social Apps */}
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6">
        <h2 className="mb-4 text-lg font-bold text-white">已連接的社交帳戶</h2>
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          </div>
        ) : (
          <div className="space-y-3">
            <ProviderRow
              name="Google"
              icon={
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              }
              connected={identities.some((i) => i.provider === 'google')}
              onDisconnect={() => {
                const googleIdentity = identities.find((i) => i.provider === 'google')
                if (googleIdentity) handleDisconnect(googleIdentity)
              }}
            />
            <ProviderRow
              name="Apple"
              icon={
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" fill="currentColor"/>
                </svg>
              }
              connected={identities.some((i) => i.provider === 'apple')}
              onDisconnect={() => {
                const appleIdentity = identities.find((i) => i.provider === 'apple')
                if (appleIdentity) handleDisconnect(appleIdentity)
              }}
            />
          </div>
        )}
      </section>

      {/* Login Activity */}
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6">
        <h2 className="mb-4 text-lg font-bold text-white">登入活動</h2>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center">
          <p className="text-sm text-white/60">
            登入活動追蹤功能尚未實施
          </p>
          <p className="mt-2 text-xs text-white/40">
            後端暫未記錄裝置及位置資料
          </p>
        </div>
      </section>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § PROVIDER ROW
// ────────────────────────────────────────────────────────────────────────────

type ProviderRowProps = {
  name: string
  icon: React.ReactNode
  connected: boolean
  onDisconnect: () => void
}

function ProviderRow({ name, icon, connected, onDisconnect }: ProviderRowProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="font-medium text-white">{name}</p>
          <p className="text-xs text-white/50">
            {connected ? '已連接' : '未連接'}
          </p>
        </div>
      </div>
      {connected && (
        <button
          onClick={onDisconnect}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white transition-colors hover:bg-white/10"
        >
          取消連接
        </button>
      )}
    </div>
  )
}
