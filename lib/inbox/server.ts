/**
 * Inbox and notification server functions (RLS enforced).
 */

import { createClient } from '@/lib/supabase/server'

export type Notification = {
  id: string
  title: string
  message: string
  type: string
  read: boolean
  createdAt: string
}

export async function getNotifications(userId: string, limit = 50): Promise<Notification[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('admin_notifications')
    .select('id, title, message, type, read, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.warn('[inbox] query failed:', error.message)
    return []
  }

  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    message: row.message,
    type: row.type,
    read: row.read,
    createdAt: row.created_at,
  }))
}

export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = await createClient()

  const { count, error } = await supabase
    .from('admin_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)

  if (error) {
    console.warn('[inbox] unread count query failed:', error.message)
    return 0
  }

  return count || 0
}

export async function markRead(notificationIds: string[]): Promise<void> {
  if (notificationIds.length === 0) return

  const supabase = await createClient()

  const { error } = await supabase
    .from('admin_notifications')
    .update({ read: true })
    .in('id', notificationIds)

  if (error) {
    console.error('[inbox] markRead failed:', error.message)
    throw new Error('Failed to mark notifications as read')
  }
}

export async function markAllRead(userId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('admin_notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false)

  if (error) {
    console.error('[inbox] markAllRead failed:', error.message)
    throw new Error('Failed to mark all notifications as read')
  }
}
