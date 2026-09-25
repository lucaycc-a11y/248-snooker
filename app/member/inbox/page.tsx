'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import { Inbox } from 'lucide-react'

// ════════════════════════════════════════════════════════════════════════════
// Inbox Page — Admin-issued offers and rewards
// Reuses existing admin_notifications table
// ════════════════════════════════════════════════════════════════════════════

type Notification = {
  id: string
  title: string
  message: string
  type: string
  read: boolean
  created_at: string
}

export default function InboxPage() {
  const supabase = createClient()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadNotifications()
  }, [])

  const loadNotifications = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data } = await supabase
      .from('admin_notifications')
      .select('id, title, message, type, read, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    setNotifications(data ?? [])
    setLoading(false)
  }

  const markAsRead = async (id: string) => {
    await supabase
      .from('admin_notifications')
      .update({ read: true })
      .eq('id', id)

    setNotifications(notifications.map((n) => (n.id === id ? { ...n, read: true } : n)))
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
            <h1 className="text-lg font-medium text-white">Inbox</h1>
            <div className="w-6" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-12 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/5">
              <Inbox className="h-10 w-10 text-white/30" strokeWidth={1.5} />
            </div>
            <p className="mt-4 text-white/60">暫無通知</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif) => (
              <NotificationCard
                key={notif.id}
                notification={notif}
                onMarkRead={() => markAsRead(notif.id)}
              />
            ))}
          </div>
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
  const isUnread = !notification.read

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-4 transition-all ${
        isUnread
          ? 'border-[#22c55e]/20 bg-gradient-to-br from-[#22c55e]/10 to-transparent'
          : 'border-white/10 bg-gradient-to-br from-white/5 to-transparent'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-white">{notification.title}</h3>
            {isUnread && (
              <span className="h-2 w-2 rounded-full bg-[#22c55e]" />
            )}
          </div>
          <p className="mt-2 text-sm text-white/70">{notification.message}</p>
          <p className="mt-2 text-xs text-white/40">
            {new Date(notification.created_at).toLocaleDateString('zh-HK', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        {isUnread && (
          <button
            onClick={onMarkRead}
            className="ml-4 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white transition-colors hover:bg-white/10"
          >
            標記為已讀
          </button>
        )}
      </div>
    </motion.div>
  )
}
