'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'

/**
 * HorizontalActionTiles — Quick Actions matching member-quick-actions.html
 *
 * 2×2 grid on mobile, 4 columns on desktop (≥640px)
 * All tiles identical size with consistent padding
 * Fetches from /api/member/wallet (balance), /api/member/points (lifetime),
 * /api/member/inbox/unread-count
 * Refreshes on focus and credit notice, no 10s polling
 */

type TileData = {
  balance: number | null
  lifetime: number | null
  unreadCount: number | null
}

export function HorizontalActionTiles() {
  const t = useTranslations('member.actions')
  const [data, setData] = useState<TileData>({
    balance: null,
    lifetime: null,
    unreadCount: null,
  })

  async function loadData() {
    try {
      // Fetch wallet balance
      const walletRes = await fetch('/api/member/wallet')
      if (walletRes.ok) {
        const walletData = await walletRes.json()
        setData((prev) => ({ ...prev, balance: walletData.balance ?? 0 }))
      }

      // Fetch points lifetime
      const pointsRes = await fetch('/api/member/points')
      if (pointsRes.ok) {
        const pointsData = await pointsRes.json()
        setData((prev) => ({ ...prev, lifetime: pointsData.lifetime ?? 0 }))
      }

      // Fetch inbox unread count
      const inboxRes = await fetch('/api/member/inbox/unread-count')
      if (inboxRes.ok) {
        const inboxData = await inboxRes.json()
        setData((prev) => ({ ...prev, unreadCount: inboxData.count ?? 0 }))
      }
    } catch (err) {
      console.error('Failed to load quick actions data:', err)
    }
  }

  useEffect(() => {
    loadData()

    // Refresh on window focus
    const handleFocus = () => loadData()
    window.addEventListener('focus', handleFocus)

    // Refresh on credit notice (custom event from wallet operations)
    const handleCreditNotice = () => loadData()
    window.addEventListener('credit-notice', handleCreditNotice)

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('credit-notice', handleCreditNotice)
    }
  }, [])

  const formatBalance = (bal: number | null) =>
    bal !== null ? `HK$${bal.toLocaleString('en-HK')}` : ''

  const formatPoints = (pts: number | null) =>
    pts !== null ? pts.toLocaleString('en-HK') : ''

  const formatUnread = (count: number | null) => {
    if (count === null || count === 0) return null
    return count > 9 ? '9+' : String(count)
  }

  return (
    <div className="m8 m8-actions">
      <div className="qa">
        {/* Help */}
        <a className="tile" href="/member/help">
          <svg className="i" aria-hidden="true">
            <use href="#i-help" />
          </svg>
          <span className="top-r"></span>
          <span>
            <span className="tt">Help</span>
            <span className="ts">{t('help.subtitle')}</span>
          </span>
        </a>

        {/* Wallet */}
        <a className="tile" href="/member/wallet">
          <svg className="i" aria-hidden="true">
            <use href="#i-wallet" />
          </svg>
          <span className="top-r">
            {data.balance !== null && (
              <span className="chipb">{formatBalance(data.balance)}</span>
            )}
          </span>
          <span>
            <span className="tt">Wallet</span>
            <span className="ts">{t('wallet.subtitle')}</span>
          </span>
        </a>

        {/* Space Pts */}
        <a className="tile" href="/member/points">
          <svg className="i" aria-hidden="true">
            <use href="#i-gem" />
          </svg>
          <span className="top-r">
            {data.lifetime !== null && (
              <span className="chipb">{formatPoints(data.lifetime)}</span>
            )}
          </span>
          <span>
            <span className="tt">Space Pts</span>
            <span className="ts">{t('points.subtitle')}</span>
          </span>
        </a>

        {/* Inbox */}
        <a className="tile" href="/member/inbox">
          <svg className="i" aria-hidden="true">
            <use href="#i-inbox" />
          </svg>
          <span className="top-r">
            {formatUnread(data.unreadCount) && (
              <span className="dot">{formatUnread(data.unreadCount)}</span>
            )}
          </span>
          <span>
            <span className="tt">Inbox</span>
            <span className="ts">{t('inbox.subtitle')}</span>
          </span>
        </a>
      </div>
    </div>
  )
}
