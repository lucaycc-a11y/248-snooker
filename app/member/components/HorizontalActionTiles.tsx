'use client'

import { useState, useEffect } from 'react'
import { type ReactElement } from 'react'
import { MessageCircle, Wallet, Gem, Inbox } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { useUnreadCount } from '@/lib/inbox/useUnreadCount'
import { type MemberProfile } from '@/lib/data/memberRedesignTypes'

// ════════════════════════════════════════════════════════════════════════════
// HorizontalActionTiles — 4 quick action tiles matching member-quick-actions.html
// 2×2 grid on mobile, 4 columns on desktop (≥640px)
// All tiles same height/width with consistent padding
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ActionTile
          icon={<MessageCircle className="h-5 w-5 flex-shrink-0" strokeWidth={1.6} />}
          title="Help"
          subtitle={t('actions.help.subtitle')}
          href="/member/help"
        />
        <ActionTile
          icon={<Wallet className="h-5 w-5 flex-shrink-0" strokeWidth={1.6} />}
          title="Wallet"
          subtitle={t('actions.wallet.subtitle')}
          href="/member/wallet"
          badge={walletBalance !== null ? `HK$${walletBalance}` : undefined}
          badgeType="text"
        />
        <ActionTile
          icon={<Gem className="h-5 w-5 flex-shrink-0" strokeWidth={1.6} />}
          title="Space Pts"
          subtitle={t('actions.points.subtitle')}
          href="/member/points"
          badge={pointsTotal !== null ? String(pointsTotal) : undefined}
          badgeType="text"
        />
        <ActionTile
          icon={<Inbox className="h-5 w-5 flex-shrink-0" strokeWidth={1.6} />}
          title="Inbox"
          subtitle={t('actions.inbox.subtitle')}
          href="/member/inbox"
          badge={unreadCount > 0 ? (unreadCount > 9 ? '9+' : String(unreadCount)) : undefined}
          badgeType="dot"
        />
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § ACTION TILE — design parity with member-quick-actions.html
// ────────────────────────────────────────────────────────────────────────────

type ActionTileProps = {
  icon: ReactElement
  title: string
  subtitle: string
  href?: string
  onClick?: () => void
  badge?: string
  badgeType?: 'text' | 'dot'
}

function ActionTile({ icon, title, subtitle, href, onClick, badge, badgeType }: ActionTileProps) {
  const content = (
    <div className="relative flex min-h-[104px] flex-col justify-between overflow-hidden rounded-[20px] border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-4 transition-all hover:border-white/[0.18] hover:bg-[#1a1a1a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25d366] active:scale-[0.97]">
      {/* Icon at bottom-left */}
      <div className="text-white">{icon}</div>

      {/* Top-right badge */}
      {badge && (
        <div className="absolute right-[14px] top-[14px] flex items-center gap-[6px]">
          {badgeType === 'dot' ? (
            <div className="flex min-h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[#25d366] px-[6px] font-code text-[11px] leading-none text-black">
              {badge}
            </div>
          ) : (
            <div className="rounded-full border border-white/[0.18] px-[9px] py-[6px] font-code text-[11px] leading-none text-white/72">
              {badge}
            </div>
          )}
        </div>
      )}

      {/* Label at bottom-right */}
      <div>
        <p className="overflow-hidden text-ellipsis whitespace-nowrap font-code text-[14px] leading-[1.2] text-white">
          {title}
        </p>
        <p className="mt-[3px] whitespace-nowrap text-[12.5px] text-white/52">
          {subtitle}
        </p>
      </div>
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
