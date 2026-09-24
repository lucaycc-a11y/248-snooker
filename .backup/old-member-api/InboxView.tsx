'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations, useLocale } from 'next-intl'
import { type Notification } from '@/lib/data/memberRedesignTypes'

// ════════════════════════════════════════════════════════════════════════════
// InboxView — P4: Notification center with tabs (All/Offers/Updates)
// Displays system notifications, offer alerts, and booking updates
// ════════════════════════════════════════════════════════════════════════════

type Props = {
  notifications: Notification[]
  onRefresh: () => void
}

export function InboxView({ notifications, onRefresh }: Props) {
  const t = useTranslations('member.inbox')
  const locale = useLocale()
  const [filter, setFilter] = useState<'all' | 'offer' | 'booking' | 'system'>('all')
  const [markingAll, setMarkingAll] = useState(false)

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'all') return true
    return n.type === filter
  })

  const unreadCount = notifications.filter((n) => !n.read).length

  const handleMarkAllRead = async () => {
    setMarkingAll(true)
    try {
      const res = await fetch('/api/member/mark-all-notifications-read', {
        method: 'POST',
      })
      if (res.ok) {
        onRefresh()
      }
    } catch {
      /* silent fail */
    } finally {
      setMarkingAll(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">{t('title')}</h2>
          {unreadCount > 0 && (
            <p className="mt-1 text-sm text-white/60">
              {unreadCount} {t('unread')}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="font-label rounded-full bg-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/20 disabled:opacity-50"
          >
            {markingAll ? t('marking_all') : t('mark_all_read')}
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        {(['all', 'offer', 'booking', 'system'] as const).map((f) => {
          const count = notifications.filter((n) => (f === 'all' ? true : n.type === f) && !n.read).length
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`font-label relative px-4 py-2 text-sm transition-colors ${
                filter === f ? 'text-white' : 'text-white/50 hover:text-white/80'
              }`}
            >
              {t(`tabs.${f}`)}
              {count > 0 && (
                <span className="font-code ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs text-white">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Notification List */}
      {filteredNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white/5 py-16 text-center backdrop-blur">
          <span className="text-6xl opacity-30">📬</span>
          <p className="mt-4 text-white/60">{t('empty_state')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filteredNotifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                locale={locale}
                onRefresh={onRefresh}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § NOTIFICATION CARD
// ────────────────────────────────────────────────────────────────────────────

type NotificationCardProps = {
  notification: Notification
  locale: string
  onRefresh: () => void
}

function NotificationCard({ notification, locale, onRefresh }: NotificationCardProps) {
  const [marking, setMarking] = useState(false)

  const title = getLocalizedField(notification, 'title', locale)
  const message = getLocalizedField(notification, 'message', locale)
  const typeIcon = getTypeIcon(notification.type)
  const typeColor = getTypeColor(notification.type)

  const handleMarkRead = async () => {
    if (notification.read) return

    setMarking(true)
    try {
      const res = await fetch('/api/member/mark-notification-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: notification.id }),
      })
      if (res.ok) {
        onRefresh()
      }
    } catch {
      /* silent fail */
    } finally {
      setMarking(false)
    }
  }

  const handleClick = () => {
    if (!notification.read) {
      handleMarkRead()
    }
    if (notification.action_url) {
      window.location.href = notification.action_url
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      onClick={handleClick}
      className={`group relative cursor-pointer overflow-hidden rounded-2xl transition-all ${
        notification.read
          ? 'bg-white/5 hover:bg-white/10'
          : 'bg-gradient-to-br from-white/15 to-white/10 hover:from-white/20 hover:to-white/15'
      } p-5 backdrop-blur-xl`}
    >
      {/* Unread Indicator */}
      {!notification.read && (
        <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-blue-500 to-cyan-500" />
      )}

      <div className="flex gap-4">
        {/* Icon */}
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${typeColor}`}>
          <span className="text-2xl">{typeIcon}</span>
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h4 className={`font-bold ${notification.read ? 'text-white/80' : 'text-white'}`}>
                {title}
              </h4>
              {message && (
                <p className={`mt-1 text-sm ${notification.read ? 'text-white/50' : 'text-white/70'}`}>
                  {message}
                </p>
              )}
            </div>
            {!notification.read && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleMarkRead()
                }}
                disabled={marking}
                className="rounded-full bg-white/10 p-2 text-sm transition-colors hover:bg-white/20 disabled:opacity-50"
              >
                {marking ? '⋯' : '✓'}
              </button>
            )}
          </div>

          {/* Timestamp */}
          <p className="mt-2 text-xs text-white/40">
            {formatRelativeTime(notification.created_at, locale)}
          </p>

          {/* Action Link */}
          {notification.action_url && (
            <div className="mt-3 flex items-center gap-2 text-sm font-medium text-blue-400 transition-colors group-hover:text-blue-300">
              <span>View Details</span>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § HELPERS
// ────────────────────────────────────────────────────────────────────────────

function getLocalizedField(notification: Notification, field: 'title' | 'message', locale: string): string {
  const localeMap: Record<string, string> = {
    'zh-HK': 'zh_hk',
    'zh-CN': 'zh_cn',
    en: 'en',
    ja: 'ja',
  }
  const suffix = localeMap[locale] ?? 'en'
  const key = `${field}_${suffix}` as keyof Notification
  return (notification[key] as string) ?? (notification[`${field}_en`] as string) ?? ''
}

function getTypeIcon(type: string): string {
  switch (type) {
    case 'offer':
      return '🎁'
    case 'booking':
      return '📅'
    case 'system':
      return '🔔'
    case 'promo':
      return '✨'
    default:
      return '📬'
  }
}

function getTypeColor(type: string): string {
  switch (type) {
    case 'offer':
      return 'bg-purple-500/20'
    case 'booking':
      return 'bg-blue-500/20'
    case 'system':
      return 'bg-amber-500/20'
    case 'promo':
      return 'bg-green-500/20'
    default:
      return 'bg-gray-500/20'
  }
}

function formatRelativeTime(timestamp: string, locale: string): string {
  const now = new Date()
  const then = new Date(timestamp)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return then.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}
