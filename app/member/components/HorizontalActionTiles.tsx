'use client'

import { useState } from 'react'
import { type ReactElement } from 'react'
import { motion } from 'framer-motion'
import { MessageCircle, Wallet, Gem, Inbox, CreditCard } from 'lucide-react'
import { type MemberProfile } from '@/lib/data/memberRedesignTypes'

// ════════════════════════════════════════════════════════════════════════════
// HorizontalActionTiles — Uber Account-style 2×2 action grid
// Icon left, label+subtitle right, no section heading
// ════════════════════════════════════════════════════════════════════════════

type Props = {
  profile: MemberProfile
}

export function HorizontalActionTiles({ profile }: Props) {
  const [walletNotifyMe, setWalletNotifyMe] = useState(false)
  const [showWalletExplainer, setShowWalletExplainer] = useState(false)

  const handleWalletClick = async () => {
    const isAdmin = await checkIsAdmin()
    if (isAdmin) {
      window.location.href = '/member/wallet'
    } else {
      setShowWalletExplainer(true)
    }
  }

  const handleNotifyToggle = async () => {
    const newValue = !walletNotifyMe
    setWalletNotifyMe(newValue)
    try {
      await fetch('/api/member/wallet-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notify: newValue }),
      })
    } catch {
      // silent fail
    }
  }

  return (
    <>
      <div className="px-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <ActionTile
            icon={<MessageCircle className="h-6 w-6 flex-shrink-0" strokeWidth={1.5} />}
            title="Help"
            subtitle="幫助中心"
            href="/member/help"
          />
          <ActionTile
            icon={<Wallet className="h-6 w-6 flex-shrink-0" strokeWidth={1.5} />}
            title="Wallet"
            subtitle="即將推出"
            onClick={handleWalletClick}
            locked
            beta
          />
          <ActionTile
            icon={<Gem className="h-6 w-6 flex-shrink-0" strokeWidth={1.5} />}
            title="Space Pts"
            subtitle="積分獎賞"
            href="/member/points"
          />
          <ActionTile
            icon={<Inbox className="h-6 w-6 flex-shrink-0" strokeWidth={1.5} />}
            title="Inbox"
            subtitle="優惠資訊"
            href="/member/inbox"
            badge={profile.unread_notifications > 0 ? profile.unread_notifications : undefined}
          />
        </div>
      </div>

      {/* Wallet explainer modal */}
      {showWalletExplainer && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowWalletExplainer(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-4 max-w-sm rounded-2xl bg-[#0F131C] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                <CreditCard className="h-8 w-8 text-white" strokeWidth={1.5} />
              </div>
            </div>
            <h3 className="text-center text-xl font-bold text-white">電子錢包功能</h3>
            <p className="mt-2 text-center text-sm text-white/60">
              我們正在開發全新的電子錢包功能，讓你更方便管理積分和優惠。
            </p>
            <div className="mt-6 flex items-center justify-between rounded-xl bg-white/5 p-4">
              <span className="text-sm text-white">開放時通知我</span>
              <button
                onClick={handleNotifyToggle}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  walletNotifyMe ? 'bg-[#22c55e]' : 'bg-white/20'
                }`}
              >
                <motion.div
                  className="absolute top-1 h-4 w-4 rounded-full bg-white"
                  animate={{ left: walletNotifyMe ? 24 : 4 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
            <button
              onClick={() => setShowWalletExplainer(false)}
              className="mt-4 w-full rounded-full bg-white/10 py-3 font-code text-sm font-medium text-white transition-colors hover:bg-white/20"
            >
              Got it
            </button>
          </motion.div>
        </motion.div>
      )}
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § ACTION TILE — icon left, label+subtitle right
// ────────────────────────────────────────────────────────────────────────────

type ActionTileProps = {
  icon: ReactElement
  title: string
  subtitle: string
  href?: string
  onClick?: () => void
  locked?: boolean
  beta?: boolean
  badge?: number
}

function ActionTile({ icon, title, subtitle, href, onClick, locked, beta, badge }: ActionTileProps) {
  const content = (
    <div className={`group relative flex min-h-[56px] items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 transition-all ${
      locked
        ? 'border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent opacity-60'
        : 'border-white/10 bg-gradient-to-br from-white/5 to-transparent hover:border-white/20 hover:from-white/10'
    }`}>
      {/* Icon */}
      <div className={locked ? 'text-white/40' : 'text-white'}>{icon}</div>

      {/* Label */}
      <div className="min-w-0 flex-1">
        <p className={`font-code text-sm font-bold leading-tight ${locked ? 'text-white/40' : 'text-white'}`}>
          {title}
        </p>
        <p className={`mt-0.5 text-xs ${locked ? 'text-white/30' : 'text-white/50'}`}>{subtitle}</p>
      </div>

      {/* Badges */}
      {beta && (
        <div className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-code font-bold text-white/60">
          BETA
        </div>
      )}
      {badge != null && (
        <div className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-code font-bold text-white">
          {badge > 9 ? '9+' : badge}
        </div>
      )}
    </div>
  )

  if (href) {
    return <a href={href}>{content}</a>
  }
  return <button className="w-full text-left" onClick={onClick}>{content}</button>
}

// ────────────────────────────────────────────────────────────────────────────
// § HELPERS
// ────────────────────────────────────────────────────────────────────────────

async function checkIsAdmin(): Promise<boolean> {
  try {
    const res = await fetch('/api/member/check-admin')
    if (res.ok) {
      const data = await res.json() as { isAdmin?: unknown }
      return data.isAdmin === true
    }
  } catch {
    // silent fail
  }
  return false
}
