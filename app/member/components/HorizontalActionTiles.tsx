'use client'

import { useState, useEffect } from 'react'
import { type ReactElement } from 'react'
import { MessageCircle, Wallet, Gem, Inbox } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { useUnreadCount } from '@/lib/inbox/useUnreadCount'
import { type MemberProfile } from '@/lib/data/memberRedesignTypes'

// ════════════════════════════════════════════════════════════════════════════
// HorizontalActionTiles — Uber Account-style 2×2 action grid
// Icon left, label+subtitle right, no section heading
// ════════════════════════════════════════════════════════════════════════════

type Props = {
  profile: MemberProfile
}

export function HorizontalActionTiles({ profile }: Props) {
  const t = useTranslations('member')
  const [userId, setUserId] = useState<string | null>(null)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [pointsTotal, setPointsTotal] = useState<number | null>(null)
  const { unreadCount } = useUnreadCount(userId)

  // Get user ID and fetch wallet/points data on mount
  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      setUserId(session?.user.id ?? null)

      // Fetch wallet balance
      try {
        const balRes = await fetch('/api/member/wallet-balance')
        if (balRes.ok) {
          const data = await balRes.json()
          setWalletBalance(data.credits ?? 0)
        }
      } catch {
        // silent fail
      }

      // Fetch points total
      try {
        const ptsRes = await fetch('/api/member/points-total')
        if (ptsRes.ok) {
          const data = await ptsRes.json()
          setPointsTotal(data.points ?? 0)
        }
      } catch {
        // silent fail
      }
    }
    init()
  }, [])

  return (
    <div className="px-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <ActionTile
          icon={<MessageCircle className="h-6 w-6 flex-shrink-0" strokeWidth={1.5} />}
          title={t('actions.help.title')}
          subtitle={t('actions.help.subtitle')}
          href="/member/help"
        />
        <ActionTile
          icon={<Wallet className="h-6 w-6 flex-shrink-0" strokeWidth={1.5} />}
          title={t('actions.wallet.title')}
          subtitle={t('actions.wallet.subtitle')}
          href="/member/wallet"
          badge={walletBalance !== null ? `HK$${walletBalance}` : undefined}
          badgeIsText
        />
        <ActionTile
          icon={<Gem className="h-6 w-6 flex-shrink-0" strokeWidth={1.5} />}
          title={t('actions.points.title')}
          subtitle={t('actions.points.subtitle')}
          href="/member/points"
          badge={pointsTotal !== null ? pointsTotal : undefined}
          badgeIsText
        />
        <ActionTile
          icon={<Inbox className="h-6 w-6 flex-shrink-0" strokeWidth={1.5} />}
          title={t('actions.inbox.title')}
          subtitle={t('actions.inbox.subtitle')}
          href="/member/inbox"
          badge={unreadCount > 0 ? (unreadCount > 9 ? '9+' : unreadCount) : undefined}
        />
      </div>
    </div>
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
  badge?: string | number
  badgeIsText?: boolean
}

function ActionTile({ icon, title, subtitle, href, onClick, locked, beta, badge, badgeIsText }: ActionTileProps) {
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
      {badge != null && badgeIsText && (
        <div className="text-xs font-code font-bold text-white/70">{badge}</div>
      )}
      {badge != null && !badgeIsText && (
        <div className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-code font-bold text-white">
          {typeof badge === 'number' && badge > 9 ? '9+' : badge}
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
