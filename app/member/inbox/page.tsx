'use client'

import { useState, useEffect } from 'react'
import { useInboxRealtime } from '@/lib/inbox/client'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import { Inbox } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

// ════════════════════════════════════════════════════════════════════════════
// Inbox Page — Member notifications with Realtime
// Route: /member/inbox
// Features: list, mark read, mark-all-read, pagination, Realtime updates
// ════════════════════════════════════════════════════════════════════════════

const ITEMS_PER_PAGE = 20

type Notification = {
  id: string
  title: string
  message: string
  type: string
  read: boolean
  createdAt: string
}

export default function InboxPage() {
  const t = useTranslations()
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [displayedNotifications, setDisplayedNotifications] = useState<Notification[]>([])
  const [allNotifications, setAllNotifications] = useState<Notification[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [isMarkingAll, setIsMarkingAll] = useState(false)

  const { notifications: realtimeNotifications, loading: realtimeLoading } = useInboxRealtime(userId)

  // Get user ID on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUserId(session?.user.id ?? null)
      setLoading(false)
    }
    getUser()
  }, [supabase])

  // Update displayedNotifications when realtime notifications change
  useEffect(() => {
    setAllNotifications(realtimeNotifications)
    setPage(1) // Reset to first page when new data arrives
  }, [realtimeNotifications])

  // Update displayed notifications based on current page
  useEffect(() => {
    const start = (page - 1) * ITEMS_PER_PAGE
    const end = start + ITEMS_PER_PAGE
    setDisplayedNotifications(allNotifications.slice(start, end))
  }, [allNotifications, page])

  const handleMarkRead = async (id: string) => {
    try {
      await fetch('/api/member/inbox', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })

      setAllNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
    } catch (err) {
      console.error('[handleMarkRead]', err)
    }
  }

  const handleMarkAllRead = async () => {
    setIsMarkingAll(true)
    try {
      await fetch('/api/member/inbox/mark-all-read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      })

      setAllNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true }))
      )
    } catch (err) {
      console.error('[handleMarkAllRead]', err)
    } finally {
      setIsMarkingAll(false)
    }
  }

  const hasUnread = allNotifications.some((n) => !n.read)
  const totalPages = Math.ceil(allNotifications.length / ITEMS_PER_PAGE)

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
            <h1 className="text-lg font-medium text-white">Inbox</h1>
            <div className="w-6" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6">
        {loading || realtimeLoading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          </div>
        ) : allNotifications.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-12 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/5">
              <Inbox className="h-10 w-10 text-white/30" strokeWidth={1.5} />
            </div>
            <p className="mt-4 text-white/60">{t('inbox.empty_state')}</p>
          </div>
        ) : (
          <>
            {/* Mark all as read button */}
            {hasUnread && (
              <div className="mb-4 flex justify-end">
                <button
                  onClick={handleMarkAllRead}
                  disabled={isMarkingAll}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition-colors hover:bg-white/10 disabled:opacity-50"
                >
                  {isMarkingAll ? t('common.loading') || '處理中...' : t('inbox.mark_all_read')}
                </button>
              </div>
            )}

            {/* Notifications list */}
            <div className="space-y-3">
              {displayedNotifications.map((notif) => (
                <NotificationCard
                  key={notif.id}
                  notification={notif}
                  onMarkRead={() => handleMarkRead(notif.id)}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition-colors hover:bg-white/10 disabled:opacity-50"
                >
                  {t('pagination.previous')}
                </button>
                <span className="text-sm text-white/60">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition-colors hover:bg-white/10 disabled:opacity-50"
                >
                  {t('pagination.next')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § NOTIFICATION CARD
// ────────────────────────────────────────────────────────────────────────────

type NotificationCardProps = {
  notification: Notification
  onMarkRead: () => void
}

function NotificationCard({ notification, onMarkRead }: NotificationCardProps) {
  const t = useTranslations()
  const isUnread = !notification.read
  const isCreditType = notification.type === 'credit'

  const relativeTime = formatRelativeTime(new Date(notification.createdAt), t)

  const content = (
    <div className={`rounded-2xl border p-4 transition-all ${
      isUnread
        ? 'border-[#22c55e]/20 bg-gradient-to-br from-[#22c55e]/10 to-transparent'
        : 'border-white/10 bg-gradient-to-br from-white/5 to-transparent'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-white">{notification.title}</h3>
            {isUnread && <span className="h-2 w-2 rounded-full bg-[#22c55e]" />}
          </div>
          <p className="mt-2 text-sm text-white/70">{notification.message}</p>
          <p className="mt-2 text-xs text-white/40">{relativeTime}</p>
        </div>
        {isUnread && (
          <button
            onClick={onMarkRead}
            className="ml-4 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white transition-colors hover:bg-white/10"
          >
            {t('inbox.mark_as_read')}
          </button>
        )}
      </div>
    </div>
  )

  // Credit notices link to wallet
  if (isCreditType) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Link href="/member/wallet">
          <div className="cursor-pointer">{content}</div>
        </Link>
      </motion.div>
    )
  }

  // Other types are non-linking
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      {content}
    </motion.div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § HELPERS
// ────────────────────────────────────────────────────────────────────────────

function formatRelativeTime(date: Date, t: any): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return t('time.just_now')
  if (diffMins < 60) return t('time.minutes_ago', { count: diffMins })
  if (diffHours < 24) return t('time.hours_ago', { count: diffHours })
  if (diffDays < 7) return t('time.days_ago', { count: diffDays })

  // Fallback: formatted date
  return date.toLocaleDateString('zh-HK', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
