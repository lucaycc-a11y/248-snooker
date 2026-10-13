/**
 * Client-side Realtime hook for inbox notifications.
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from './server'

export function useInboxRealtime(userId: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch initial notifications
  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    const fetchInitial = async () => {
      try {
        const resp = await fetch(`/api/member/inbox?limit=50`)
        const data = await resp.json()
        if (data.notifications) {
          setNotifications(data.notifications)
        }
      } catch (err) {
        console.warn('[useInboxRealtime] initial fetch failed:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchInitial()
  }, [userId])

  // Subscribe to Realtime INSERT events for this user's notifications
  useEffect(() => {
    if (!userId) return

    const supabase = createClient()
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'admin_notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification
          setNotifications((prev) => [newNotif, ...prev])
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  return { notifications, loading }
}
