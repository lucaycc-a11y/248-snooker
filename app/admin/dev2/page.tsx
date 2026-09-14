'use client'

import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type EnvInfo = {
  env: string
  admin: {
    userId: string
    email: string
    role: string
    displayName: string | null
  }
  clientIp: string
  isIpWhitelisted: boolean
  gateEnabled: boolean
  activeTestPrice: {
    mode: string
    amount: number
    label: string | null
  } | null
}

type DeployStatus = {
  uat: { sha: string; message: string }
  main: { sha: string; message: string }
  diverged: boolean
}

export default function Dev2Panel() {
  const [activeTab, setActiveTab] = useState('env')
  const [envInfo, setEnvInfo] = useState<EnvInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEnvInfo()
  }, [])

  async function fetchEnvInfo() {
    try {
      const res = await fetch('/api/dev2/env-info')
      if (res.ok) {
        const data = await res.json()
        setEnvInfo(data)
      }
    } catch (err) {
      console.error('Failed to fetch env info:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24, color: 'var(--admin-text-muted)' }}>
        Loading dev2 panel...
      </div>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24, color: 'var(--admin-text)' }}>
        Dev2 Panel
      </h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="env">Env Info</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
          <TabsTrigger value="vercel">Vercel Logs</TabsTrigger>
          <TabsTrigger value="auth">Auth Log</TabsTrigger>
          <TabsTrigger value="payment">Payment Log</TabsTrigger>
          <TabsTrigger value="whitelist">IP Whitelist</TabsTrigger>
          <TabsTrigger value="deploy">Deploy</TabsTrigger>
          <TabsTrigger value="actions">Quick Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="env">
          <EnvInfoTab envInfo={envInfo} />
        </TabsContent>

        <TabsContent value="activity">
          <ActivityLogTab />
        </TabsContent>

        <TabsContent value="vercel">
          <VercelLogsTab />
        </TabsContent>

        <TabsContent value="auth">
          <AuthLogTab />
        </TabsContent>

        <TabsContent value="payment">
          <PaymentLogTab />
        </TabsContent>

        <TabsContent value="whitelist">
          <WhitelistTab />
        </TabsContent>

        <TabsContent value="deploy">
          <DeployTab />
        </TabsContent>

        <TabsContent value="actions">
          <QuickActionsTab envInfo={envInfo} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function EnvInfoTab({ envInfo }: { envInfo: EnvInfo | null }) {
  if (!envInfo) return <div>No data</div>

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Environment Information</h2>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'auto 1fr', maxWidth: 600 }}>
        <strong>Environment:</strong>
        <span>{envInfo.env}</span>

        <strong>Admin Email:</strong>
        <span>{envInfo.admin.email}</span>

        <strong>Role:</strong>
        <span>{envInfo.admin.role}</span>

        <strong>Client IP:</strong>
        <span>
          {envInfo.clientIp}{' '}
          {envInfo.isIpWhitelisted && <span style={{ color: 'var(--admin-success)' }}>(whitelisted)</span>}
        </span>

        <strong>Gate Enabled:</strong>
        <span>{envInfo.gateEnabled ? 'Yes' : 'No'}</span>

        <strong>Active Test Price:</strong>
        <span>
          {envInfo.activeTestPrice
            ? `${envInfo.activeTestPrice.mode} - HK$${envInfo.activeTestPrice.amount}${
                envInfo.activeTestPrice.label ? ` (${envInfo.activeTestPrice.label})` : ''
              }`
            : 'None'}
        </span>
      </div>
    </div>
  )
}

function ActivityLogTab() {
  const [logs, setLogs] = useState<any[]>([])

  useEffect(() => {
    // Capture console logs
    const originalLog = console.log
    const originalWarn = console.warn
    const originalError = console.error

    const capturedLogs: any[] = []

    console.log = (...args) => {
      capturedLogs.push({ type: 'log', timestamp: new Date().toISOString(), message: args.join(' ') })
      originalLog.apply(console, args)
    }
    console.warn = (...args) => {
      capturedLogs.push({ type: 'warn', timestamp: new Date().toISOString(), message: args.join(' ') })
      originalWarn.apply(console, args)
    }
    console.error = (...args) => {
      capturedLogs.push({ type: 'error', timestamp: new Date().toISOString(), message: args.join(' ') })
      originalError.apply(console, args)
    }

    setLogs(capturedLogs.slice(-200))

    return () => {
      console.log = originalLog
      console.warn = originalWarn
      console.error = originalError
    }
  }, [])

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Activity Log (Client-side)</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(logs, null, 2))
              alert('Copied to clipboard')
            }}
            style={{
              padding: '6px 12px',
              background: 'var(--admin-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Copy All
          </button>
          <button
            onClick={() => setLogs([])}
            style={{
              padding: '6px 12px',
              background: 'var(--admin-danger)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        </div>
      </div>
      <div
        style={{
          background: '#000',
          color: '#0f0',
          fontFamily: 'monospace',
          fontSize: 12,
          padding: 16,
          borderRadius: 8,
          maxHeight: 500,
          overflow: 'auto',
        }}
      >
        {logs.length === 0 ? (
          <div>No logs captured yet</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              <span style={{ color: '#888' }}>[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
              <span
                style={{
                  color: log.type === 'error' ? '#f00' : log.type === 'warn' ? '#ff0' : '#0f0',
                }}
              >
                {log.type.toUpperCase()}
              </span>
              : {log.message}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function VercelLogsTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dev2/vercel-logs')
      .then((res) => res.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>
  if (!data) return <div style={{ padding: 24 }}>No data</div>

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Vercel Logs</h2>

      {data.latestDeployment && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Latest Deployment</h3>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'auto 1fr', maxWidth: 600 }}>
            <strong>URL:</strong>
            <a href={`https://${data.latestDeployment.url}`} target="_blank" rel="noopener">
              {data.latestDeployment.url}
            </a>
            <strong>State:</strong>
            <span>{data.latestDeployment.state}</span>
            <strong>Created:</strong>
            <span>{new Date(data.latestDeployment.createdAt).toLocaleString()}</span>
            <strong>Target:</strong>
            <span>{data.latestDeployment.target}</span>
          </div>
        </div>
      )}

      <div>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Runtime Logs</h3>
        <pre
          style={{
            background: '#000',
            color: '#0f0',
            padding: 16,
            borderRadius: 8,
            overflow: 'auto',
            maxHeight: 400,
            fontSize: 12,
          }}
        >
          {JSON.stringify(data.runtimeLogs, null, 2)}
        </pre>
      </div>
    </div>
  )
}

function AuthLogTab() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dev2/auth-log')
      .then((res) => res.json())
      .then((data) => setEvents(data.events || []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Auth Log</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--admin-border)' }}>
            <th style={{ padding: 12, textAlign: 'left' }}>Timestamp</th>
            <th style={{ padding: 12, textAlign: 'left' }}>Action</th>
            <th style={{ padding: 12, textAlign: 'left' }}>User</th>
            <th style={{ padding: 12, textAlign: 'left' }}>Outcome</th>
          </tr>
        </thead>
        <tbody>
          {events.map((evt) => (
            <tr key={evt.id} style={{ borderBottom: '1px solid var(--admin-border)' }}>
              <td style={{ padding: 12, fontSize: 13 }}>{new Date(evt.timestamp).toLocaleString()}</td>
              <td style={{ padding: 12, fontSize: 13 }}>{evt.action}</td>
              <td style={{ padding: 12, fontSize: 13, fontFamily: 'monospace' }}>{evt.userIdentifier}</td>
              <td style={{ padding: 12, fontSize: 13 }}>{String(evt.outcome)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PaymentLogTab() {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dev2/payment-log')
      .then((res) => res.json())
      .then((data) => setPayments(data.payments || []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Payment Log</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--admin-border)' }}>
            <th style={{ padding: 12, textAlign: 'left' }}>Timestamp</th>
            <th style={{ padding: 12, textAlign: 'left' }}>Booking ID</th>
            <th style={{ padding: 12, textAlign: 'left' }}>Amount</th>
            <th style={{ padding: 12, textAlign: 'left' }}>Method</th>
            <th style={{ padding: 12, textAlign: 'left' }}>Status</th>
            <th style={{ padding: 12, textAlign: 'left' }}>Test</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid var(--admin-border)' }}>
              <td style={{ padding: 12, fontSize: 13 }}>{new Date(p.createdAt).toLocaleString()}</td>
              <td style={{ padding: 12, fontSize: 13, fontFamily: 'monospace' }}>{p.bookingId.slice(0, 8)}</td>
              <td style={{ padding: 12, fontSize: 13 }}>HK${p.amount}</td>
              <td style={{ padding: 12, fontSize: 13 }}>{p.method}</td>
              <td style={{ padding: 12, fontSize: 13 }}>{p.status}</td>
              <td style={{ padding: 12, fontSize: 13 }}>{p.isTest ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function WhitelistTab() {
  const [whitelist, setWhitelist] = useState<any[]>([])
  const [pending, setPending] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchData() {
    setLoading(true)
    try {
      const res = await fetch('/api/dev2/ip-whitelist')
      if (res.ok) {
        const data = await res.json()
        setWhitelist(data.whitelist || [])
        setPending(data.pending || [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  async function approveIp(ip: string) {
    if (!confirm(`Approve IP ${ip}?`)) return
    const res = await fetch('/api/dev2/ip-whitelist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip }),
    })
    if (res.ok) {
      alert('IP approved')
      fetchData()
    } else {
      alert('Failed to approve IP')
    }
  }

  async function deleteIp(id: string) {
    if (!confirm('Delete this IP?')) return
    const res = await fetch(`/api/dev2/ip-whitelist?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      alert('IP deleted')
      fetchData()
    } else {
      alert('Failed to delete IP')
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>IP Whitelist</h2>

      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Current Whitelist</h3>
        {whitelist.length === 0 ? (
          <div>No IPs whitelisted</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--admin-border)' }}>
                <th style={{ padding: 12, textAlign: 'left' }}>IP</th>
                <th style={{ padding: 12, textAlign: 'left' }}>Label</th>
                <th style={{ padding: 12, textAlign: 'left' }}>Added</th>
                <th style={{ padding: 12, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {whitelist.map((w) => (
                <tr key={w.id} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                  <td style={{ padding: 12, fontFamily: 'monospace' }}>{w.ipAddress}</td>
                  <td style={{ padding: 12 }}>{w.label || '-'}</td>
                  <td style={{ padding: 12 }}>{new Date(w.createdAt).toLocaleString()}</td>
                  <td style={{ padding: 12, textAlign: 'right' }}>
                    <button
                      onClick={() => deleteIp(w.id)}
                      style={{
                        padding: '4px 8px',
                        background: 'var(--admin-danger)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Pending Requests</h3>
        {pending.length === 0 ? (
          <div>No pending requests</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--admin-border)' }}>
                <th style={{ padding: 12, textAlign: 'left' }}>IP</th>
                <th style={{ padding: 12, textAlign: 'left' }}>First Seen</th>
                <th style={{ padding: 12, textAlign: 'left' }}>Count</th>
                <th style={{ padding: 12, textAlign: 'left' }}>User Agents</th>
                <th style={{ padding: 12, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((p) => (
                <tr key={p.ip} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                  <td style={{ padding: 12, fontFamily: 'monospace' }}>{p.ip}</td>
                  <td style={{ padding: 12 }}>{new Date(p.firstSeen).toLocaleString()}</td>
                  <td style={{ padding: 12 }}>{p.count}</td>
                  <td style={{ padding: 12, fontSize: 12, maxWidth: 300, overflow: 'hidden' }}>
                    {p.userAgents.slice(0, 2).join(', ')}
                  </td>
                  <td style={{ padding: 12, textAlign: 'right' }}>
                    <button
                      onClick={() => approveIp(p.ip)}
                      style={{
                        padding: '4px 8px',
                        background: 'var(--admin-success)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    >
                      Approve
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function DeployTab() {
  const [status, setStatus] = useState<DeployStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [deploying, setDeploying] = useState(false)

  async function fetchStatus() {
    setLoading(true)
    try {
      const res = await fetch('/api/dev2/deploy')
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  async function executeDeploy(action: string, confirmText: string) {
    const confirmation = prompt(`Type "${confirmText}" to confirm:`)
    if (confirmation !== confirmText) return

    setDeploying(true)
    try {
      const res = await fetch('/api/dev2/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, confirmation: confirmText }),
      })
      const data = await res.json()
      if (res.ok) {
        alert(data.message)
        fetchStatus()
      } else {
        alert(data.error || 'Deploy failed')
      }
    } finally {
      setDeploying(false)
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>
  if (!status) return <div style={{ padding: 24 }}>No data</div>

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Deploy</h2>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'auto 1fr', maxWidth: 700 }}>
          <strong>UAT HEAD:</strong>
          <span style={{ fontFamily: 'monospace' }}>
            {status.uat.sha} - {status.uat.message}
          </span>

          <strong>Main HEAD:</strong>
          <span style={{ fontFamily: 'monospace' }}>
            {status.main.sha} - {status.main.message}
          </span>

          <strong>Status:</strong>
          <span>{status.diverged ? 'UAT has new commits' : 'In sync'}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={() => executeDeploy('push', 'PUSH')}
          disabled={deploying || !status.diverged}
          style={{
            padding: '12px 24px',
            background: status.diverged ? 'var(--admin-primary)' : '#666',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: status.diverged ? 'pointer' : 'not-allowed',
            fontWeight: 600,
          }}
        >
          Push to Main
        </button>

        <button
          onClick={() => executeDeploy('maintenance', 'PUSH')}
          disabled={deploying || !status.diverged}
          style={{
            padding: '12px 24px',
            background: status.diverged ? '#ff8800' : '#666',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: status.diverged ? 'pointer' : 'not-allowed',
            fontWeight: 600,
          }}
        >
          Push to Maintenance
        </button>

        <button
          onClick={() => executeDeploy('go_live', 'GO LIVE')}
          disabled={deploying}
          style={{
            padding: '12px 24px',
            background: 'var(--admin-success)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Go Live
        </button>
      </div>
    </div>
  )
}

function QuickActionsTab({ envInfo }: { envInfo: EnvInfo | null }) {
  const [priceMode, setPriceMode] = useState('flat')
  const [priceAmount, setPriceAmount] = useState('1')
  const [priceLabel, setPriceLabel] = useState('')
  const [bookings, setBookings] = useState<any[]>([])

  useEffect(() => {
    fetchBookings()
  }, [])

  async function fetchBookings() {
    const res = await fetch('/api/dev2/test-bookings')
    if (res.ok) {
      const data = await res.json()
      setBookings(data.bookings || [])
    }
  }

  async function setTestPrice() {
    const res = await fetch('/api/dev2/test-pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: priceMode, amount: parseFloat(priceAmount), label: priceLabel }),
    })
    if (res.ok) {
      alert('Test price updated')
      window.location.reload()
    } else {
      alert('Failed to update price')
    }
  }

  async function refundBooking(bookingId: string) {
    const confirmation = prompt('Type REFUND to confirm:')
    if (confirmation !== 'REFUND') return

    const res = await fetch('/api/dev2/test-bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, confirmation: 'REFUND' }),
    })
    if (res.ok) {
      alert('Refunded successfully')
      fetchBookings()
    } else {
      const data = await res.json()
      alert(data.error || 'Refund failed')
    }
  }

  async function deleteMyBookings() {
    if (!confirm('Delete all your test bookings?')) return
    const res = await fetch('/api/dev2/test-bookings', { method: 'DELETE' })
    if (res.ok) {
      const data = await res.json()
      alert(`Deleted ${data.deletedCount} bookings`)
      fetchBookings()
    } else {
      alert('Failed to delete bookings')
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Quick Actions</h2>

      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Set UAT Test Price</h3>
        {envInfo?.activeTestPrice && (
          <div style={{ marginBottom: 12, padding: 12, background: 'var(--admin-bg-secondary)', borderRadius: 6 }}>
            Current: {envInfo.activeTestPrice.mode} - HK${envInfo.activeTestPrice.amount}
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <select
            value={priceMode}
            onChange={(e) => setPriceMode(e.target.value)}
            style={{
              padding: '8px 12px',
              background: 'var(--admin-bg-secondary)',
              border: '1px solid var(--admin-border)',
              borderRadius: 6,
            }}
          >
            <option value="flat">Flat</option>
            <option value="per_hour">Per Hour</option>
          </select>
          <input
            type="number"
            value={priceAmount}
            onChange={(e) => setPriceAmount(e.target.value)}
            placeholder="Amount"
            style={{
              padding: '8px 12px',
              background: 'var(--admin-bg-secondary)',
              border: '1px solid var(--admin-border)',
              borderRadius: 6,
            }}
          />
          <input
            type="text"
            value={priceLabel}
            onChange={(e) => setPriceLabel(e.target.value)}
            placeholder="Label (optional)"
            style={{
              flex: 1,
              padding: '8px 12px',
              background: 'var(--admin-bg-secondary)',
              border: '1px solid var(--admin-border)',
              borderRadius: 6,
            }}
          />
          <button
            onClick={setTestPrice}
            style={{
              padding: '8px 16px',
              background: 'var(--admin-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Set
          </button>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>Test Bookings</h3>
          <button
            onClick={deleteMyBookings}
            style={{
              padding: '6px 12px',
              background: 'var(--admin-danger)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Delete My Test Bookings
          </button>
        </div>
        {bookings.length === 0 ? (
          <div>No test bookings</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--admin-border)' }}>
                <th style={{ padding: 12, textAlign: 'left' }}>Date/Time</th>
                <th style={{ padding: 12, textAlign: 'left' }}>Table</th>
                <th style={{ padding: 12, textAlign: 'left' }}>Price</th>
                <th style={{ padding: 12, textAlign: 'left' }}>Payment</th>
                <th style={{ padding: 12, textAlign: 'left' }}>Status</th>
                <th style={{ padding: 12, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                  <td style={{ padding: 12 }}>
                    {b.date} {b.startTime}-{b.endTime}
                  </td>
                  <td style={{ padding: 12 }}>{b.tableNumber}</td>
                  <td style={{ padding: 12 }}>HK${b.totalPrice}</td>
                  <td style={{ padding: 12 }}>{b.paymentStatus}</td>
                  <td style={{ padding: 12 }}>{b.status}</td>
                  <td style={{ padding: 12, textAlign: 'right' }}>
                    {b.status !== 'refunded' && b.paymentStatus === 'succeeded' && (
                      <button
                        onClick={() => refundBooking(b.id)}
                        style={{
                          padding: '4px 8px',
                          background: 'var(--admin-warning)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                        }}
                      >
                        Refund
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
