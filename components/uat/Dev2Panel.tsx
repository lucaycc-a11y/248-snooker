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

type Tab = 'activity' | 'env' | 'actions' | 'whitelist' | 'deploy'

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

type DeployInfo = {
  mainBranch: {
    sha: string
    message: string
  }
  uatBranch: {
    sha: string
    message: string
  }
  isUpToDate: boolean
  gateEnabled: boolean
}

type DeployStatus = 'idle' | 'merging' | 'success' | 'error'

/** The active UAT test-price override. Test bookings charge REAL money. */
type TestPrice = {
  id: string
  mode: 'flat' | 'per_hour'
  amount: number
  label: string | null
  updatedAt: string
}

type TestBooking = {
  id: string
  humanCode: string | null
  date: string
  startTime: string
  endTime: string
  tableNumber: number | null
  durationHours: number | null
  totalPrice: number | null
  status: string
  paymentMethod: string | null
  providerOrderNo: string | null
  refundedAt: string | null
  refundAmount: number | null
  createdAt: string
  isOwn: boolean
  attemptId: string | null
  attemptStatus: string | null
  refundable: boolean
}

export function Dev2Panel({ mode = 'uat' }: { mode?: 'uat' | 'production-review' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('activity')
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([])
  const [envInfo, setEnvInfo] = useState<EnvInfo | null>(null)
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([])
  const [isLoadingWhitelist, setIsLoadingWhitelist] = useState(false)
  const [newIpAddress, setNewIpAddress] = useState('')
  const [newIpLabel, setNewIpLabel] = useState('')
  const [deployInfo, setDeployInfo] = useState<DeployInfo | null>(null)
  const [deployStatus, setDeployStatus] = useState<DeployStatus>('idle')
  const [deployError, setDeployError] = useState<string | null>(null)
  const [pushConfirmText, setPushConfirmText] = useState('')
  const [goLiveConfirmText, setGoLiveConfirmText] = useState('')

  // ── UAT test pricing + refunds ──────────────────────────────────────────
  const [testPrice, setTestPrice] = useState<TestPrice | null>(null)
  const [isLoadingTestPrice, setIsLoadingTestPrice] = useState(false)
  const [priceMode, setPriceMode] = useState<'flat' | 'per_hour'>('flat')
  const [priceAmount, setPriceAmount] = useState('1')
  const [priceLabel, setPriceLabel] = useState('')
  const [priceSaving, setPriceSaving] = useState(false)
  const [testBookings, setTestBookings] = useState<TestBooking[]>([])
  const [isLoadingTestBookings, setIsLoadingTestBookings] = useState(false)
  const [refundTargetId, setRefundTargetId] = useState<string | null>(null)
  const [refundConfirmText, setRefundConfirmText] = useState('')
  const [refundingId, setRefundingId] = useState<string | null>(null)

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

  // Load deploy info when switching to deploy tab
  useEffect(() => {
    if (isOpen && activeTab === 'actions' && envInfo?.isAdmin) {
      loadTestPrice()
      loadTestBookings()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeTab, envInfo?.isAdmin])

  useEffect(() => {
    if (isOpen && activeTab === 'deploy' && envInfo?.isAdmin) {
      loadDeployInfo()
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

  const loadDeployInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/deploy/info')
      if (res.ok) {
        const data = await res.json()
        setDeployInfo(data)
      }
    } catch (err) {
      console.error('[dev2] Failed to load deploy info', err)
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

  const loadTestPrice = useCallback(async () => {
    setIsLoadingTestPrice(true)
    try {
      const res = await fetch('/api/uat/test-pricing')
      const data = await res.json()
      if (res.ok) setTestPrice(data.active ?? null)
    } catch (err) {
      console.error('[dev2] loadTestPrice failed', err)
    } finally {
      setIsLoadingTestPrice(false)
    }
  }, [])

  const loadTestBookings = useCallback(async () => {
    setIsLoadingTestBookings(true)
    try {
      const res = await fetch('/api/uat/test-bookings')
      const data = await res.json()
      if (res.ok) setTestBookings(Array.isArray(data.bookings) ? data.bookings : [])
    } catch (err) {
      console.error('[dev2] loadTestBookings failed', err)
    } finally {
      setIsLoadingTestBookings(false)
    }
  }, [])

  const handleSetTestPrice = useCallback(async () => {
    const amount = Number(priceAmount)
    if (!Number.isFinite(amount) || amount < 1) {
      alert('Amount must be at least 1 — KPay rejects zero-amount orders.')
      return
    }
    setPriceSaving(true)
    try {
      const res = await fetch('/api/uat/test-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: priceMode,
          amount,
          ...(priceLabel.trim() ? { label: priceLabel.trim() } : {}),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setTestPrice(data.active ?? null)
        setPriceLabel('')
        alert(
          `Test price set: ${priceMode === 'flat' ? `HK$${amount} flat` : `HK$${amount}/hour`}`,
        )
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (err) {
      alert('Failed to set test price')
      console.error(err)
    } finally {
      setPriceSaving(false)
    }
  }, [priceMode, priceAmount, priceLabel])

  const handleRefundTestBooking = useCallback(
    async (bookingId: string) => {
      if (refundConfirmText !== 'REFUND') {
        alert('Type "REFUND" to confirm')
        return
      }
      setRefundingId(bookingId)
      try {
        const res = await fetch('/api/uat/test-bookings/refund', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId }),
        })
        const data = await res.json()
        if (res.ok) {
          setRefundTargetId(null)
          setRefundConfirmText('')
          // Refresh so the row's status reflects the refund without a page reload.
          await loadTestBookings()
          alert(
            data.warning
              ? `Refunded HK$${data.refundAmount} — WARNING: ${data.warning}`
              : `Refunded HK$${data.refundAmount}${data.providerRefundNo ? ` (KPay refund no: ${data.providerRefundNo})` : ''}`,
          )
        } else {
          alert(`Refund failed: ${data.error}`)
        }
      } catch (err) {
        alert('Refund request failed')
        console.error(err)
      } finally {
        setRefundingId(null)
      }
    },
    [refundConfirmText, loadTestBookings],
  )

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

  const handlePushToMaintenance = useCallback(async () => {
    if (pushConfirmText !== 'PUSH TO MAINTENANCE') {
      alert('Type "PUSH TO MAINTENANCE" to confirm')
      return
    }

    setDeployStatus('merging')
    setDeployError(null)

    try {
      const res = await fetch('/api/deploy/push-to-maintenance', { method: 'POST' })
      const data = await res.json()

      if (res.ok) {
        setDeployStatus('success')
        setPushConfirmText('')
        loadDeployInfo()
        alert(`Successfully merged to main. New commit: ${data.commitSha}`)
      } else {
        setDeployStatus('error')
        setDeployError(data.error || 'Unknown error')
        alert(`Error: ${data.error}`)
      }
    } catch (err) {
      setDeployStatus('error')
      setDeployError(err instanceof Error ? err.message : 'Network error')
      alert('Failed to push to maintenance')
      console.error(err)
    }
  }, [pushConfirmText, loadDeployInfo])

  const handleGoLive = useCallback(async () => {
    if (goLiveConfirmText !== 'GO LIVE') {
      alert('Type "GO LIVE" to confirm')
      return
    }

    setDeployStatus('merging')
    setDeployError(null)

    try {
      const res = await fetch('/api/deploy/go-live', { method: 'POST' })
      const data = await res.json()

      if (res.ok) {
        setDeployStatus('success')
        setGoLiveConfirmText('')
        loadDeployInfo()
        alert('Site is now live! Gate disabled.')
      } else {
        setDeployStatus('error')
        setDeployError(data.error || 'Unknown error')
        alert(`Error: ${data.error}`)
      }
    } catch (err) {
      setDeployStatus('error')
      setDeployError(err instanceof Error ? err.message : 'Network error')
      alert('Failed to go live')
      console.error(err)
    }
  }, [goLiveConfirmText, loadDeployInfo])

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
        {([
          'activity',
          'env',
          'actions',
          ...(envInfo?.isAdmin ? ['whitelist' as const, 'deploy' as const] : []),
        ] as Tab[]).map((tab) => (
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
            {envInfo?.isAdmin && (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '10px',
                  background: '#1a1a1a',
                  border: '1px solid #ff9800',
                  borderRadius: '4px',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    color: '#ff9800',
                    fontWeight: 600,
                    marginBottom: '6px',
                    letterSpacing: '0.04em',
                  }}
                >
                  UAT TEST PRICE
                </div>

                {/* Test bookings hit the production KPay account, so what they
                    cost must be impossible to miss. */}
                <div style={{ fontSize: '13px', color: '#e0e0e0', marginBottom: '2px' }}>
                  {isLoadingTestPrice
                    ? 'Loading…'
                    : testPrice
                      ? testPrice.mode === 'flat'
                        ? `HK$${testPrice.amount} per booking (flat)`
                        : `HK$${testPrice.amount} per hour`
                      : 'No override — test bookings charge the FULL real price'}
                </div>
                {testPrice?.label && (
                  <div style={{ fontSize: '11px', color: '#999' }}>{testPrice.label}</div>
                )}
                <div style={{ fontSize: '10px', color: '#d32f2f', marginTop: '6px' }}>
                  Real money: UAT shares the production KPay merchant account.
                </div>

                <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                  <select
                    value={priceMode}
                    onChange={(e) =>
                      setPriceMode(e.target.value === 'per_hour' ? 'per_hour' : 'flat')
                    }
                    style={{
                      flex: '1 1 0',
                      padding: '6px',
                      background: '#222',
                      border: '1px solid #555',
                      borderRadius: '4px',
                      color: '#e0e0e0',
                      fontSize: '11px',
                    }}
                  >
                    <option value="flat">Flat</option>
                    <option value="per_hour">Per hour</option>
                  </select>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={priceAmount}
                    onChange={(e) => setPriceAmount(e.target.value)}
                    placeholder="HK$"
                    style={{
                      flex: '1 1 0',
                      padding: '6px',
                      background: '#222',
                      border: '1px solid #555',
                      borderRadius: '4px',
                      color: '#e0e0e0',
                      fontSize: '11px',
                    }}
                  />
                </div>
                <input
                  type="text"
                  value={priceLabel}
                  onChange={(e) => setPriceLabel(e.target.value)}
                  placeholder="Label (optional)"
                  style={{
                    width: '100%',
                    marginTop: '6px',
                    padding: '6px',
                    background: '#222',
                    border: '1px solid #555',
                    borderRadius: '4px',
                    color: '#e0e0e0',
                    fontSize: '11px',
                  }}
                />
                <button
                  onClick={handleSetTestPrice}
                  disabled={priceSaving}
                  style={{
                    width: '100%',
                    marginTop: '6px',
                    padding: '7px',
                    background: priceSaving ? '#555' : '#ff9800',
                    border: 'none',
                    borderRadius: '4px',
                    color: priceSaving ? '#999' : '#000',
                    cursor: priceSaving ? 'not-allowed' : 'pointer',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  {priceSaving ? 'Saving…' : 'Set UAT Test Price'}
                </button>
              </div>
            )}

            {envInfo?.isAdmin && (
              <div style={{ marginBottom: '16px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px',
                  }}
                >
                  <span style={{ fontSize: '11px', color: '#ff9800', fontWeight: 600 }}>
                    REFUND TEST BOOKING
                  </span>
                  <button
                    onClick={loadTestBookings}
                    style={{
                      padding: '3px 8px',
                      background: 'transparent',
                      border: '1px solid #555',
                      borderRadius: '4px',
                      color: '#999',
                      cursor: 'pointer',
                      fontSize: '10px',
                    }}
                  >
                    Refresh
                  </button>
                </div>

                {isLoadingTestBookings ? (
                  <div style={{ fontSize: '11px', color: '#999' }}>Loading…</div>
                ) : testBookings.length === 0 ? (
                  <div style={{ fontSize: '11px', color: '#999' }}>No test bookings yet.</div>
                ) : (
                  <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
                    {testBookings.map((b) => (
                      <div
                        key={b.id}
                        style={{
                          padding: '7px',
                          marginBottom: '5px',
                          background: '#1a1a1a',
                          border: '1px solid #333',
                          borderRadius: '4px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '11px',
                            color: '#e0e0e0',
                          }}
                        >
                          <span>{b.humanCode ?? b.id.slice(0, 8)}</span>
                          <span>HK${b.totalPrice ?? 0}</span>
                        </div>
                        <div style={{ fontSize: '10px', color: '#999', marginTop: '2px' }}>
                          {b.date} {b.startTime}–{b.endTime}
                          {b.tableNumber ? ` · T${b.tableNumber}` : ''}
                          {b.paymentMethod ? ` · ${b.paymentMethod}` : ''}
                        </div>
                        <div style={{ fontSize: '10px', color: '#777', marginTop: '2px' }}>
                          {b.status}
                          {b.attemptStatus ? ` · attempt: ${b.attemptStatus}` : ''}
                          {b.refundedAt ? ` · refunded HK$${b.refundAmount ?? 0}` : ''}
                        </div>

                        {b.refundedAt ? (
                          <div style={{ fontSize: '10px', color: '#4caf50', marginTop: '4px' }}>
                            Refunded
                          </div>
                        ) : !b.refundable ? (
                          <div style={{ fontSize: '10px', color: '#777', marginTop: '4px' }}>
                            Not refundable (no successful charge)
                          </div>
                        ) : refundTargetId === b.id ? (
                          <div style={{ marginTop: '5px' }}>
                            <input
                              type="text"
                              value={refundConfirmText}
                              onChange={(e) => setRefundConfirmText(e.target.value)}
                              placeholder='Type "REFUND"'
                              style={{
                                width: '100%',
                                padding: '5px',
                                background: '#222',
                                border: '1px solid #d32f2f',
                                borderRadius: '4px',
                                color: '#e0e0e0',
                                fontSize: '11px',
                              }}
                            />
                            <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                              <button
                                onClick={() => handleRefundTestBooking(b.id)}
                                disabled={refundingId === b.id || refundConfirmText !== 'REFUND'}
                                style={{
                                  flex: 1,
                                  padding: '5px',
                                  background:
                                    refundingId === b.id || refundConfirmText !== 'REFUND'
                                      ? '#555'
                                      : '#d32f2f',
                                  border: 'none',
                                  borderRadius: '4px',
                                  color:
                                    refundingId === b.id || refundConfirmText !== 'REFUND'
                                      ? '#999'
                                      : '#fff',
                                  cursor:
                                    refundingId === b.id || refundConfirmText !== 'REFUND'
                                      ? 'not-allowed'
                                      : 'pointer',
                                  fontSize: '10px',
                                }}
                              >
                                {refundingId === b.id ? 'Refunding…' : 'Confirm Refund'}
                              </button>
                              <button
                                onClick={() => {
                                  setRefundTargetId(null)
                                  setRefundConfirmText('')
                                }}
                                style={{
                                  flex: 1,
                                  padding: '5px',
                                  background: 'transparent',
                                  border: '1px solid #555',
                                  borderRadius: '4px',
                                  color: '#999',
                                  cursor: 'pointer',
                                  fontSize: '10px',
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setRefundTargetId(b.id)
                              setRefundConfirmText('')
                            }}
                            style={{
                              width: '100%',
                              marginTop: '5px',
                              padding: '5px',
                              background: 'transparent',
                              border: '1px solid #d32f2f',
                              borderRadius: '4px',
                              color: '#d32f2f',
                              cursor: 'pointer',
                              fontSize: '10px',
                            }}
                          >
                            Refund
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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

        {activeTab === 'deploy' && envInfo?.isAdmin && (
          <div>
            {!deployInfo ? (
              <div>Loading...</div>
            ) : (
              <div>
                <div style={{ marginBottom: '16px', fontSize: '12px' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <strong>Main Branch:</strong>
                    <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                      {deployInfo.mainBranch.sha.substring(0, 7)} — {deployInfo.mainBranch.message}
                    </div>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <strong>UAT Branch:</strong>
                    <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                      {deployInfo.uatBranch.sha.substring(0, 7)} — {deployInfo.uatBranch.message}
                    </div>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <strong>Status:</strong>{' '}
                    {deployInfo.isUpToDate ? (
                      <span style={{ color: '#4caf50' }}>Up to date</span>
                    ) : (
                      <span style={{ color: '#ff9800' }}>UAT ahead of main</span>
                    )}
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <strong>Gate Enabled:</strong>{' '}
                    {deployInfo.gateEnabled ? (
                      <span style={{ color: '#f44336' }}>Yes (Maintenance mode)</span>
                    ) : (
                      <span style={{ color: '#4caf50' }}>No (Public)</span>
                    )}
                  </div>
                </div>

                {deployStatus === 'error' && deployError && (
                  <div
                    style={{
                      marginBottom: '16px',
                      padding: '12px',
                      background: '#d32f2f',
                      borderRadius: '4px',
                      fontSize: '12px',
                    }}
                  >
                    Error: {deployError}
                  </div>
                )}

                {/* Push to Maintenance */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ marginBottom: '8px', fontSize: '12px', fontWeight: 'bold' }}>
                    Push to Maintenance
                  </div>
                  <div style={{ fontSize: '11px', color: '#999', marginBottom: '8px' }}>
                    Merge UAT → main, enable gate (internal review mode)
                  </div>
                  <input
                    type="text"
                    placeholder='Type "PUSH TO MAINTENANCE" to confirm'
                    value={pushConfirmText}
                    onChange={(e) => setPushConfirmText(e.target.value)}
                    disabled={deployInfo.isUpToDate || deployStatus === 'merging'}
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
                    onClick={handlePushToMaintenance}
                    disabled={
                      deployInfo.isUpToDate ||
                      pushConfirmText !== 'PUSH TO MAINTENANCE' ||
                      deployStatus === 'merging'
                    }
                    style={{
                      padding: '8px 16px',
                      background:
                        deployInfo.isUpToDate || pushConfirmText !== 'PUSH TO MAINTENANCE'
                          ? '#555'
                          : '#ff9800',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#fff',
                      cursor:
                        deployInfo.isUpToDate || pushConfirmText !== 'PUSH TO MAINTENANCE'
                          ? 'not-allowed'
                          : 'pointer',
                      fontSize: '12px',
                      width: '100%',
                    }}
                  >
                    {deployStatus === 'merging' ? 'Merging...' : 'Push to Maintenance'}
                  </button>
                </div>

                {/* Go Live */}
                <div>
                  <div style={{ marginBottom: '8px', fontSize: '12px', fontWeight: 'bold' }}>
                    Go Live (End Maintenance)
                  </div>
                  <div style={{ fontSize: '11px', color: '#999', marginBottom: '8px' }}>
                    Disable gate, make site public (no deploy)
                  </div>
                  <input
                    type="text"
                    placeholder='Type "GO LIVE" to confirm'
                    value={goLiveConfirmText}
                    onChange={(e) => setGoLiveConfirmText(e.target.value)}
                    disabled={!deployInfo.gateEnabled || deployStatus === 'merging'}
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
                    onClick={handleGoLive}
                    disabled={
                      !deployInfo.gateEnabled || goLiveConfirmText !== 'GO LIVE' || deployStatus === 'merging'
                    }
                    style={{
                      padding: '8px 16px',
                      background:
                        !deployInfo.gateEnabled || goLiveConfirmText !== 'GO LIVE' ? '#555' : '#4caf50',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#fff',
                      cursor:
                        !deployInfo.gateEnabled || goLiveConfirmText !== 'GO LIVE'
                          ? 'not-allowed'
                          : 'pointer',
                      fontSize: '12px',
                      width: '100%',
                    }}
                  >
                    {deployStatus === 'merging' ? 'Processing...' : 'Go Live'}
                  </button>
                </div>
              </div>
            )}
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
