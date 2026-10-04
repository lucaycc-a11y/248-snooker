'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { InboxItem, InboxResponse } from '@/lib/member-contracts'
import { relativeTime, dayGroupLabel } from '@/lib/member-format'

export default function InboxPage() {
  const t = useTranslations('inbox')
  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null)
  const [filter, setFilter] = useState<'all' | 'credit' | 'promo' | 'system'>('all')

  useEffect(() => {
    fetchInbox()
  }, [])

  async function fetchInbox() {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/member/inbox')
      if (!res.ok) throw new Error('Failed to fetch inbox')
      const data: InboxResponse = await res.json()
      setItems(data.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function markAsRead(id: string) {
    try {
      const res = await fetch('/api/member/inbox/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      })
      if (!res.ok) throw new Error('Failed to mark as read')

      setItems(prev => prev.map(item =>
        item.id === id ? { ...item, read: true } : item
      ))
    } catch (err) {
      console.error('Mark as read failed:', err)
    }
  }

  function handleItemClick(item: InboxItem) {
    setSelectedItem(item)
    if (!item.read) {
      markAsRead(item.id)
    }
  }

  const filteredItems = items.filter(item =>
    filter === 'all' || item.type === filter
  )

  const groupedItems = groupByDay(filteredItems)

  if (loading) {
    return (
      <div className="m8 m8-inbox">
        <main className="app">
          <div className="top">
            <span />
            <span className="t">{t('title')}</span>
            <span />
          </div>
          <div className="sticky">
            <div className="tabs">
              <button className="tab" aria-selected="true">{t('filterAll')}</button>
              <button className="tab">{t('filterCredit')}</button>
              <button className="tab">{t('filterPromo')}</button>
              <button className="tab">{t('filterSystem')}</button>
            </div>
          </div>
          <div style={{ marginTop: '24px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="group" style={{ marginBottom: '12px' }}>
                <div className="row">
                  <div className="skel" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                  <div style={{ flex: 1 }}>
                    <div className="skel" style={{ width: '60%', height: '16px', marginBottom: '8px' }} />
                    <div className="skel" style={{ width: '40%', height: '14px' }} />
                  </div>
                  <div className="skel" style={{ width: '60px', height: '14px' }} />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="m8 m8-inbox">
        <main className="app">
          <div className="top">
            <span />
            <span className="t">{t('title')}</span>
            <span />
          </div>
          <div className="alert" style={{ marginTop: '24px' }}>
            <svg className="i" viewBox="0 0 24 24">
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z" />
              <path d="M12 8v4m0 4h.01" />
            </svg>
            <div>
              <h3>{t('errorTitle')}</h3>
              <p>{t('errorMessage')}</p>
              <button className="btn secondary sm" onClick={fetchInbox}>
                {t('retry')}
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (selectedItem) {
    return (
      <div className="m8 m8-inbox">
        <main className="app">
          <div className="top">
            <button className="icon-btn" onClick={() => setSelectedItem(null)}>
              <svg className="i" viewBox="0 0 24 24">
                <path d="M19 12H5m0 0l7 7m-7-7l7-7" />
              </svg>
            </button>
            <span className="t">{t('detailTitle')}</span>
            <span />
          </div>
        <div className="msg-detail">
          <div className="detail-header">
            <div className="ic">
              {getTypeIcon(selectedItem.type)}
            </div>
            <div className="badge">{getTypeBadgeText(selectedItem.type, t)}</div>
          </div>
          <div className="detail-meta">
            <div className="meta-row">
              <span className="meta-label">{t('metaType')}</span>
              <span className="meta-value">{getTypeBadgeText(selectedItem.type, t)}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">{t('metaTime')}</span>
              <span className="meta-value">{formatFullTime(selectedItem.createdAt)}</span>
            </div>
          </div>
          <div className="detail-content">
            <h2>{selectedItem.title}</h2>
            <p>{selectedItem.message}</p>
          </div>
        </div>
        </main>
      </div>
    )
  }

  return (
    <div className="m8 m8-inbox">
      <main className="app">
        <div className="top">
          <span />
          <span className="t">{t('title')}</span>
          <span />
        </div>

      <div className="sticky">
        <div className="tabs">
          <button
            className="tab"
            aria-selected={filter === 'all'}
            onClick={() => setFilter('all')}
          >
            {t('filterAll')}
          </button>
          <button
            className="tab"
            aria-selected={filter === 'credit'}
            onClick={() => setFilter('credit')}
          >
            {t('filterCredit')}
          </button>
          <button
            className="tab"
            aria-selected={filter === 'promo'}
            onClick={() => setFilter('promo')}
          >
            {t('filterPromo')}
          </button>
          <button
            className="tab"
            aria-selected={filter === 'system'}
            onClick={() => setFilter('system')}
          >
            {t('filterSystem')}
          </button>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="empty">
          <div className="ic">
            <svg className="i" viewBox="0 0 24 24">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
          </div>
          <h3>{t('emptyTitle')}</h3>
          <p>{t('emptyMessage')}</p>
        </div>
      ) : (
        Object.entries(groupedItems).map(([dayLabel, dayItems]) => (
          <div key={dayLabel}>
            <div className="month">{dayLabel}</div>
            <div className="group">
              {dayItems.map(item => (
                <button
                  key={item.id}
                  className={`msg${!item.read ? ' unread' : ''}`}
                  onClick={() => handleItemClick(item)}
                  aria-current={false}
                >
                  <div className={`ic${item.type === 'credit' ? ' k-credit' : ''}`}>
                    {getTypeIcon(item.type)}
                  </div>
                  <div>
                    <div className="mt">
                      {item.title}
                      {!item.read && <span className="udot" />}
                    </div>
                    <div className="mb">{truncateMessage(item.message)}</div>
                  </div>
                  <div className="tm">
                    {relativeTime(item.createdAt)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))
      )}
      </main>
    </div>
  )
}

function groupByDay(items: InboxItem[]): Record<string, InboxItem[]> {
  const groups: Record<string, InboxItem[]> = {}
  const now = new Date()

  for (const item of items) {
    const label = dayGroupLabel(item.createdAt, now)
    if (!groups[label]) groups[label] = []
    groups[label].push(item)
  }

  return groups
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'credit':
      return (
        <svg className="i" viewBox="0 0 24 24">
          <path d="M19 21v-4a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v4" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      )
    case 'promo':
      return (
        <svg className="i" viewBox="0 0 24 24">
          <path d="M20 12v8H4v-8m16 0V6.828a2 2 0 0 0-.586-1.414l-2.828-2.828A2 2 0 0 0 15.172 2H8.828a2 2 0 0 0-1.414.586L4.586 5.414A2 2 0 0 0 4 6.828V12m16 0H4" />
        </svg>
      )
    case 'system':
    default:
      return (
        <svg className="i" viewBox="0 0 24 24">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      )
  }
}

function getTypeBadgeText(type: string, t: (key: string) => string): string {
  return t(`type${type.charAt(0).toUpperCase()}${type.slice(1)}` as never)
}

function truncateMessage(msg: string, maxLength = 60): string {
  return msg.length > maxLength ? `${msg.slice(0, maxLength)}...` : msg
}

function formatFullTime(isoString: string): string {
  const date = new Date(isoString)
  const formatter = new Intl.DateTimeFormat('zh-HK', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Hong_Kong',
  })
  return formatter.format(date)
}
