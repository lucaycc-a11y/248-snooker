'use client'

// Dev2 debug panel for UAT environment - comprehensive debugging tools
// ONLY renders when NEXT_PUBLIC_APP_ENV === 'uat'

import { useEffect, useState, useCallback } from 'react'
import {
  initActivityLogger,
  useActivityLog,
  getActivityEntries,
  clearActivityLog,
  exportActivityLog,
  type ActivityEntry,
} from '@/lib/uat/activity-logger'

type Tab = 'activity' | 'env' | 'actions' | 'whitelist'

type EnvInfo = {
  appEnv: string
  userId: string | null
  userEmail: string | null
  userTier: string | null
  isIpWhitelisted: boolean
  isAdmin: boolean
}

type WhitelistEntry = {
  id: string
  ip_address: string
  label: string | null
  created_at: string
}

export function Dev2Panel() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('activity')
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([])
  const [envInfo, setEnvInfo] = useState<EnvInfo | null>(null)
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([])
  const [isLoadingWhitelist, setIsLoadingWhitelist] = useState(false)
  const [newIpAddress, setNewIpAddress] = useState('')
  const [newIpLabel, setNewIpLabel] = useState('')

  // Initialize activity logger on mount
  useEffect(() => {
    initActivityLogger()
  }, [])

  // Subscribe to activity log updates
  useEffect(() => {
    const unsubscribe = useActivityLog(() => {
      setActivityEntries(getActivityEntries())
    })
    return unsubscribe
  }, [])

  // Load env info when panel opens
  useEffect(() => {
    if (isOpen && !envInfo) {
      loadEnvInfo()
    }
  }, [isOpen])

  // Load whitelist when switching to whitelist tab
  useEffect(() => {
    if (isOpen && activeTab === 'whitelist' && envInfo?.isAdmin) {
      loadWhitelist()
    }
  }, [isOpen, activeTab, envInfo?.isAdmin])

  const loadEnvInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/uat/env-info')
      if (res.ok) {
        const data = await res.json()
        setEnvInfo(data)
      }
    } catch (err) {
      console.error('[dev2] Failed to load env info', err)
    }
  }, [])

  const loadWhitelist = useCallback(async () => {
    setIsLoadingWhitelist(true)
    try {
      const res = await fetch('/api/uat/ip-whitelist')
      if (res.ok) {
        const data = await res.json()
        setWhitelist(data.entries || [])
      }
    } catch (err) {
      console.error('[dev2] Failed to load whitelist', err)
    } finally {
      setIsLoadingWhitelist(false)
    }
  }, [])

  const handleCopyLog = useCallback(() => {
    const text = exportActivityLog()
    navigator.clipboard.writeText(text).then(() => {
      alert('Activity log copied to clipboard')
    })
  }, [])

  const handleClearLog = useCallback(() => {
    if (confirm('Clear activity log?')) {
      clearActivityLog()
      setActivityEntries([])
    }
  }, [])

  const handleDeleteTestBookings = useCallback(async () => {
    if (!confirm('Delete all YOUR test bookings (is_test=true only)?')) return

    try {
      const res = await fetch('/api/uat/delete-test-bookings', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        alert(`Deleted ${data.deletedCount} test booking(s)`)
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (err) {
      alert('Failed to delete test bookings')
      console.error(err)
    }
  }, [])

  const handleAddCurrentIp = useCallback(async () => {
    try {
      const res = await fetch('/api/uat/ip-whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addCurrent: true }),
      })
      const data = await res.json()
      if (res.ok) {
        alert(`Added IP: ${data.ip_address}`)
        loadWhitelist()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (err) {
      alert('Failed to add current IP')
      console.error(err)
    }
  }, [loadWhitelist])

  const handleAddManualIp = useCallback(async () => {
    if (!newIpAddress.trim()) return

    try {
      const res = await fetch('/api/uat/ip-whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip_address: newIpAddress, label: newIpLabel || null }),
      })
      const data = await res.json()
      if (res.ok) {
        alert('IP added')
        setNewIpAddress('')
        setNewIpLabel('')
        loadWhitelist()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (err) {
      alert('Failed to add IP')
      console.error(err)
    }
  }, [newIpAddress, newIpLabel, loadWhitelist])

  const handleDeleteIp = useCallback(
    async (id: string) => {
      if (!confirm('Delete this IP from whitelist?')) return

      try {
        const res = await fetch(`/api/uat/ip-whitelist?id=${id}`, { method: 'DELETE' })
        if (res.ok) {
          alert('IP deleted')
          loadWhitelist()
        } else {
          const data = await res.json()
          alert(`Error: ${data.error}`)
        }
      } catch (err) {
        alert('Failed to delete IP')
        console.error(err)
      }
    },
    [loadWhitelist]
  )

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '60px',
        left: '16px',
        width: '400px',
        maxHeight: '600px',
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#e0e0e0',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontWeight: 'bold', color: '#ff9800' }}>Dev2 Panel</span>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: 'none',
            border: 'none',
            color: '#999',
            cursor: 'pointer',
            fontSize: '18px',
            padding: '0 4px',
          }}
        >
          ×
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #333' }}>
        {(['activity', 'env', 'actions', ...(envInfo?.isAdmin ? ['whitelist' as const] : [])] as Tab[]).map(
          (tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '10px 8px',
                background: activeTab === tab ? '#333' : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid #ff9800' : '2px solid transparent',
                color: activeTab === tab ? '#ff9800' : '#999',
                cursor: 'pointer',
                fontSize: '12px',
                textTransform: 'capitalize',
              }}
            >
              {tab}
            </button>
          )
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {activeTab === 'activity' && (
          <div>
            <div style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
              <button
                onClick={handleCopyLog}
                style={{
                  padding: '6px 12px',
                  background: '#333',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: '#e0e0e0',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Copy All
              </button>
              <button
                onClick={handleClearLog}
                style={{
                  padding: '6px 12px',
                  background: '#333',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: '#e0e0e0',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Clear
              </button>
            </div>
            <div style={{ fontSize: '11px', color: '#999' }}>
              {activityEntries.length === 0 ? (
                <div>No activity logged yet</div>
              ) : (
                activityEntries
                  .slice()
                  .reverse()
                  .map((entry, idx) => (
                    <div
                      key={idx}
                      style={{
                        marginBottom: '8px',
                        padding: '8px',
                        background: '#222',
                        borderRadius: '4px',
                        borderLeft:
                          entry.type === 'console'
                            ? entry.level === 'error'
                              ? '3px solid #f44336'
                              : entry.level === 'warn'
                                ? '3px solid #ff9800'
                                : '3px solid #4caf50'
                            : '3px solid #2196f3',
                      }}
                    >
                      <div style={{ color: '#999', fontSize: '10px' }}>
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </div>
                      {entry.type === 'console' ? (
                        <div>
                          <strong style={{ color: '#ff9800' }}>[{entry.level.toUpperCase()}]</strong>{' '}
                          {entry.args.map((arg) => String(arg)).join(' ')}
                        </div>
                      ) : (
                        <div>
                          <strong style={{ color: '#2196f3' }}>[FETCH]</strong> {entry.method} {entry.url}
                          {entry.status && <span style={{ color: '#4caf50' }}> {entry.status}</span>}
                          {entry.duration && <span style={{ color: '#999' }}> ({entry.duration}ms)</span>}
                          {entry.error && <span style={{ color: '#f44336' }}> ERROR: {entry.error}</span>}
                        </div>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'env' && (
          <div style={{ fontSize: '12px' }}>
            {!envInfo ? (
              <div>Loading...</div>
            ) : (
              <div>
                <div style={{ marginBottom: '12px' }}>
                  <strong>Environment:</strong> {envInfo.appEnv}
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <strong>User ID:</strong> {envInfo.userId || 'Not logged in'}
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <strong>Email:</strong> {envInfo.userEmail || 'N/A'}
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <strong>Tier:</strong> {envInfo.userTier || 'N/A'}
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <strong>IP Whitelisted:</strong> {envInfo.isIpWhitelisted ? 'Yes' : 'No'}
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <strong>Admin:</strong> {envInfo.isAdmin ? 'Yes' : 'No'}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'actions' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <button
                onClick={handleDeleteTestBookings}
                style={{
                  padding: '8px 16px',
                  background: '#d32f2f',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '12px',
                  width: '100%',
                }}
              >
                Delete My Test Bookings
              </button>
              <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                Deletes only your bookings where is_test=true
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px' }}>
                Jump to Date:
              </label>
              <input
                type="date"
                onChange={(e) => {
                  if (e.target.value) {
                    window.location.href = `/book?date=${e.target.value}`
                  }
                }}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: '#222',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: '#e0e0e0',
                  fontSize: '12px',
                }}
              />
            </div>
          </div>
        )}

        {activeTab === 'whitelist' && envInfo?.isAdmin && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <button
                onClick={handleAddCurrentIp}
                style={{
                  padding: '8px 16px',
                  background: '#4caf50',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '12px',
                  width: '100%',
                  marginBottom: '8px',
                }}
              >
                Add My Current IP
              </button>
              <div style={{ fontSize: '11px', color: '#999' }}>
                Adds your request IP to the production site gate whitelist
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>
                Add IP Manually:
              </label>
              <input
                type="text"
                placeholder="IP Address"
                value={newIpAddress}
                onChange={(e) => setNewIpAddress(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: '#222',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: '#e0e0e0',
                  fontSize: '12px',
                  marginBottom: '8px',
                }}
              />
              <input
                type="text"
                placeholder="Label (optional)"
                value={newIpLabel}
                onChange={(e) => setNewIpLabel(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: '#222',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: '#e0e0e0',
                  fontSize: '12px',
                  marginBottom: '8px',
                }}
              />
              <button
                onClick={handleAddManualIp}
                style={{
                  padding: '8px 16px',
                  background: '#2196f3',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '12px',
                  width: '100%',
                }}
              >
                Add IP
              </button>
            </div>

            <div>
              <div style={{ fontSize: '12px', marginBottom: '8px', fontWeight: 'bold' }}>
                Current Whitelist:
              </div>
              {isLoadingWhitelist ? (
                <div>Loading...</div>
              ) : whitelist.length === 0 ? (
                <div style={{ fontSize: '11px', color: '#999' }}>No IPs whitelisted</div>
              ) : (
                whitelist.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      padding: '8px',
                      background: '#222',
                      borderRadius: '4px',
                      marginBottom: '8px',
                      fontSize: '11px',
                    }}
                  >
                    <div style={{ marginBottom: '4px' }}>
                      <strong>{entry.ip_address}</strong>
                    </div>
                    {entry.label && <div style={{ color: '#999' }}>{entry.label}</div>}
                    <div style={{ color: '#666', fontSize: '10px', marginTop: '4px' }}>
                      {new Date(entry.created_at).toLocaleString()}
                    </div>
                    <button
                      onClick={() => handleDeleteIp(entry.id)}
                      style={{
                        marginTop: '8px',
                        padding: '4px 8px',
                        background: '#d32f2f',
                        border: 'none',
                        borderRadius: '4px',
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: '11px',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function Dev2Badge() {
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  // Only render in UAT environment
  if (process.env.NEXT_PUBLIC_APP_ENV !== 'uat') return null

  return (
    <>
      <button
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        style={{
          position: 'fixed',
          bottom: '16px',
          left: '16px',
          zIndex: 9999,
          backgroundColor: 'rgba(255, 165, 0, 0.95)',
          color: '#000',
          padding: '8px 16px',
          borderRadius: '4px',
          fontFamily: 'var(--font-good-times, system-ui)',
          fontSize: '14px',
          fontWeight: 'bold',
          letterSpacing: '0.5px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          userSelect: 'none',
          border: 'none',
          cursor: 'pointer',
        }}
        aria-label="UAT Testing Environment - Open Debug Panel"
      >
        UAT TEST
      </button>

      {isPanelOpen && (
        <>
          {/* Click-outside overlay */}
          <div
            onClick={() => setIsPanelOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9998,
            }}
          />
          <Dev2Panel />
        </>
      )}
    </>
  )
}
