'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { MessageCircle, Wallet, Gem, Inbox, CreditCard } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type MemberProfile } from '@/lib/data/memberRedesignTypes'

// ════════════════════════════════════════════════════════════════════════════
// ActionGrid — 2×2 grid: Help · Wallet · Space Pts · Inbox
// Space Pts: points detail view entry
// Wallet: locked preview + notify-me toggle for non-admin; real for admin
// ════════════════════════════════════════════════════════════════════════════

type Props = {
  profile: MemberProfile
}

export function ActionGrid({ profile }: Props) {
  const t = useTranslations('member')
  const [walletNotifyMe, setWalletNotifyMe] = useState(false)
  const [showWalletExplainer, setShowWalletExplainer] = useState(false)

  const handleWalletClick = async () => {
    // Check if user is admin
    const isAdmin = await checkIsAdmin()

    if (isAdmin) {
      // Admin sees real Wallet (stub for now)
      window.location.href = '/member/wallet'
    } else {
      // Non-admin sees locked preview
      setShowWalletExplainer(true)
    }
  }

  const handleNotifyToggle = async () => {
    const newValue = !walletNotifyMe
    setWalletNotifyMe(newValue)

    // Save opt-in to DB
    try {
      await fetch('/api/member/wallet-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notify: newValue }),
      })
    } catch {
      // Silent fail
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <ActionCard
          icon={<MessageCircle className="h-10 w-10" strokeWidth={1.5} />}
          title={t('actions.help.title')}
          subtitle={t('actions.help.subtitle')}
          href="/member/help"
        />

        <ActionCard
          icon={<Wallet className="h-10 w-10" strokeWidth={1.5} />}
          title={t('actions.wallet.title')}
          subtitle={t('actions.wallet.subtitle')}
          onClick={handleWalletClick}
          locked
          beta
        />

        <ActionCard
          icon={<Gem className="h-10 w-10" strokeWidth={1.5} />}
          title={t('actions.points.title')}
          subtitle={t('actions.points.subtitle')}
          href="/member/points"
        />

        <ActionCard
          icon={<Inbox className="h-10 w-10" strokeWidth={1.5} />}
          title={t('actions.inbox.title')}
          subtitle={t('actions.inbox.subtitle')}
          href="/member/inbox"
          badge={profile.unread_notifications > 0 ? profile.unread_notifications : undefined}
        />
      </div>

      {/* Wallet Explainer Modal */}
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
            <h3 className="text-center text-xl font-bold text-white">{t('wallet_explainer.title')}</h3>
            <p className="mt-2 text-center text-sm text-white/60">
              {t('wallet_explainer.description')}
            </p>

            <div className="mt-6 flex items-center justify-between rounded-xl bg-white/5 p-4">
              <span className="text-sm text-white">{t('wallet_explainer.notify_label')}</span>
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
              className="mt-4 w-full rounded-full bg-white/10 py-3 text-sm font-medium text-white transition-colors hover:bg-white/20"
            >
              {t('wallet_explainer.dismiss')}
            </button>
          </motion.div>
        </motion.div>
      )}
    </>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § ACTION CARD
// ────────────────────────────────────────────────────────────────────────────

type ActionCardProps = {
  icon: JSX.Element
  title: string
  subtitle: string
  href?: string
  onClick?: () => void
  locked?: boolean
  beta?: boolean
  badge?: number
}

function ActionCard({ icon, title, subtitle, href, onClick, locked, beta, badge }: ActionCardProps) {
  const content = (
    <div className={`group relative h-32 overflow-hidden rounded-2xl border p-4 transition-all ${
      locked
        ? 'border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent opacity-60'
        : 'border-white/10 bg-gradient-to-br from-white/5 to-transparent hover:border-white/20 hover:from-white/10'
    }`}>
      {beta && (
        <div className="absolute right-2 top-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white/60">
          BETA
        </div>
      )}
      {badge && (
        <div className="absolute right-2 top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
          {badge > 9 ? '9+' : badge}
        </div>
      )}
      <div className="flex h-full flex-col justify-between">
        <div className={locked ? 'text-white/40' : 'text-white'}>{icon}</div>
        <div>
          <p className={`text-lg font-bold ${locked ? 'text-white/40' : 'text-white'}`}>{title}</p>
          <p className={`text-xs ${locked ? 'text-white/30' : 'text-white/50'}`}>{subtitle}</p>
        </div>
      </div>
    </div>
  )

  if (href) {
    return <a href={href}>{content}</a>
  }

  return <button onClick={onClick}>{content}</button>
}

// ────────────────────────────────────────────────────────────────────────────
// § HELPERS
// ────────────────────────────────────────────────────────────────────────────

async function checkIsAdmin(): Promise<boolean> {
  try {
    const res = await fetch('/api/member/check-admin')
    if (res.ok) {
      const data = await res.json()
      return data.isAdmin === true
    }
  } catch {
    // Silent fail
  }
  return false
}
