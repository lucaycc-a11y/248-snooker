'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Hook to track unread notification count with realtime updates.
 * Subscribes to UPDATE events on admin_notifications table
 * and recalculates unread count whenever a notification's read status changes.
 */
export function useUnreadCount(userId: string | null) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  // Fetch initial unread count
  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    const fetchUnreadCount = async () => {
      try {
        const resp = await fetch('/api/member/inbox/unread-count')
        if (resp.ok) {
          const data = await resp.json()
          setUnreadCount(data.unreadCount ?? 0)
        }
      } catch (err) {
        console.warn('[useUnreadCount] initial fetch failed:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchUnreadCount()
  }, [userId])

  // Subscribe to realtime UPDATE events for notifications
  useEffect(() => {
    if (!userId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`notifications-updates:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'admin_notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // When any notification is updated, refetch the unread count
          fetchUpdatedCount()
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // When a new notification arrives, refetch the unread count
          fetchUpdatedCount()
        },
      )
      .subscribe()

    async function fetchUpdatedCount() {
      try {
        const resp = await fetch('/api/member/inbox/unread-count')
        if (resp.ok) {
          const data = await resp.json()
          setUnreadCount(data.unreadCount ?? 0)
        }
      } catch (err) {
        console.warn('[useUnreadCount] refetch failed:', err)
      }
    }

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  return { unreadCount, loading }
}
