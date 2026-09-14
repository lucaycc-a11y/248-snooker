'use client'

import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { X, RefreshCw, Trash2, Check, AlertCircle } from 'lucide-react'
import { formatVersion } from '@/lib/version'

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
  gateReason: string | null
  activeTestPrice: {
    mode: string
    amount: number
    label: string | null
  } | null
}

type GitStatus = {
  uat: { sha: string; message: string }
  main: { sha: string; message: string }
  diverged: boolean
}

type Payment = {
  id: string
  total_price: number
  payment_method: string
  payment_status: string
  is_test: boolean
  created_at: string
}

type AuthEvent = {
  id: string
  user_id: string
  action: string
  details: any
  created_at: string
}

type WhitelistEntry = {
  ip_address: string
  label: string | null
  added_at: string
}

type PendingRequest = {
  ip: string
  firstSeen: string
  lastSeen: string
  count: number
  userAgent: string | null
}

type ActivityLogEntry = {
  timestamp: string
  type: 'log' | 'warn' | 'error' | 'fetch'
  message: string
  data?: any
}

type Dev2PanelProps = {
  onClose?: () => void
}

export function Dev2Panel({ onClose }: Dev2PanelProps) {
  const [activeTab, setActiveTab] = useState('env')

  return (
    <div style={{ padding: 24, maxHeight: '90vh', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--foreground)', marginBottom: 4 }}>
            Dev2 Panel · {formatVersion()}
          </h1>
          <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>
            UAT testing and deployment management
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              padding: 8,
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--foreground)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={20} />
          </button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="env">Env Info</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
          <TabsTrigger value="payment">Payment Log</TabsTrigger>
          <TabsTrigger value="auth">Auth Log</TabsTrigger>
          <TabsTrigger value="ip">IP Whitelist</TabsTrigger>
          <TabsTrigger value="deploy">Deploy</TabsTrigger>
          <TabsTrigger value="actions">Quick Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="env">
          <EnvInfoTab />
        </TabsContent>

        <TabsContent value="activity">
          <ActivityLogTab />
        </TabsContent>

        <TabsContent value="payment">
          <PaymentLogTab />
        </TabsContent>

        <TabsContent value="auth">
          <AuthLogTab />
        </TabsContent>

        <TabsContent value="ip">
          <IpWhitelistTab />
        </TabsContent>

        <TabsContent value="deploy">
          <DeployTab />
        </TabsContent>

        <TabsContent value="actions">
          <QuickActionsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function EnvInfoTab() {
  const [data, setData] = useState<EnvInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const res = await fetch('/api/dev2/env-info')
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (err) {
      console.error('Failed to fetch env info:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>
  if (!data) return <div style={{ padding: 24 }}>No data</div>

  return (
    <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
      <InfoRow label="Environment" value={data.env} />
      <InfoRow label="User" value={data.admin.email} />
      <InfoRow label="Role" value={data.admin.role} />
      <InfoRow label="Client IP" value={data.clientIp} />
      <InfoRow label="IP Whitelisted" value={data.isIpWhitelisted ? '✓ Yes' : '✗ No'} />
      <InfoRow label="Gate Enabled" value={data.gateEnabled ? `✓ Yes (${data.gateReason || 'unknown'})` : '✗ No'} />
      <InfoRow
        label="Active Test Price"
        value={
          data.activeTestPrice
            ? `${data.activeTestPrice.mode} · HK$${data.activeTestPrice.amount}${data.activeTestPrice.label ? ` · ${data.activeTestPrice.label}` : ''}`
            : 'None'
        }
      />
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: 12,
        background: 'var(--muted)',
        borderRadius: 8,
      }}
    >
      <span style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>{label}</span>
      <span style={{ color: 'var(--foreground)', fontSize: 14, fontWeight: 600, fontFamily: 'monospace' }}>{value}</span>
    </div>
  )
}

function ActivityLogTab() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([])
  const maxLogs = 200

  useEffect(() => {
    // Capture console methods
    const originalLog = console.log
    const originalWarn = console.warn
    const originalError = console.error
    const originalFetch = window.fetch

    console.log = (...args: any[]) => {
      originalLog(...args)
      setLogs((prev) =>
        [{ timestamp: new Date().toISOString(), type: 'log' as const, message: args.join(' ') }, ...prev].slice(0, maxLogs)
      )
    }

    console.warn = (...args: any[]) => {
      originalWarn(...args)
      setLogs((prev) =>
        [{ timestamp: new Date().toISOString(), type: 'warn' as const, message: args.join(' ') }, ...prev].slice(0, maxLogs)
      )
    }

    console.error = (...args: any[]) => {
      originalError(...args)
      setLogs((prev) =>
        [{ timestamp: new Date().toISOString(), type: 'error' as const, message: args.join(' ') }, ...prev].slice(0, maxLogs)
      )
    }

    window.fetch = async (...args: any[]) => {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || 'unknown'
      const method = args[1]?.method || 'GET'
      setLogs((prev) =>
        [{ timestamp: new Date().toISOString(), type: 'fetch' as const, message: `${method} ${url}` }, ...prev].slice(0, maxLogs)
      )
      return originalFetch(...args)
    }

    return () => {
      console.log = originalLog
      console.warn = originalWarn
      console.error = originalError
      window.fetch = originalFetch
    }
  }, [])

  function copyAll() {
    const text = logs.map((l) => `[${l.timestamp}] ${l.type.toUpperCase()}: ${l.message}`).join('\n')
    navigator.clipboard.writeText(text)
  }

  function clear() {
    setLogs([])
  }

  const typeColor = (type: string) => {
    switch (type) {
      case 'log':
        return 'var(--foreground)'
      case 'warn':
        return 'orange'
      case 'error':
        return 'var(--destructive)'
      case 'fetch':
        return 'cyan'
      default:
        return 'var(--muted-foreground)'
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={copyAll}
          style={{
            padding: '8px 16px',
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Copy All
        </button>
        <button
          onClick={clear}
          style={{
            padding: '8px 16px',
            background: 'var(--destructive)',
            color: 'var(--destructive-foreground)',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Clear
        </button>
        <span style={{ marginLeft: 'auto', color: 'var(--muted-foreground)', fontSize: 14, lineHeight: '36px' }}>
          {logs.length} / {maxLogs} entries
        </span>
      </div>
      <div
        style={{
          background: '#000',
          padding: 16,
          borderRadius: 8,
          maxHeight: 500,
          overflow: 'auto',
          fontFamily: 'monospace',
          fontSize: 12,
        }}
      >
        {logs.length === 0 && <div style={{ color: '#666' }}>No activity logged yet</div>}
        {logs.map((log, i) => (
          <div key={i} style={{ marginBottom: 4, color: typeColor(log.type) }}>
            <span style={{ color: '#666' }}>[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
            <span style={{ color: '#888' }}>{log.type.toUpperCase()}:</span> {log.message}
          </div>
        ))}
      </div>
    </div>
  )
}

function PaymentLogTab() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const res = await fetch('/api/dev2/payment-log')
      if (res.ok) {
        const json = await res.json()
        setPayments(json.payments)
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ padding: 12, textAlign: 'left' }}>ID</th>
              <th style={{ padding: 12, textAlign: 'left' }}>Amount</th>
              <th style={{ padding: 12, textAlign: 'left' }}>Method</th>
              <th style={{ padding: 12, textAlign: 'left' }}>Status</th>
              <th style={{ padding: 12, textAlign: 'left' }}>Test</th>
              <th style={{ padding: 12, textAlign: 'left' }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: 12, fontFamily: 'monospace', fontSize: 12 }}>{p.id.slice(0, 8)}</td>
                <td style={{ padding: 12, fontWeight: 600 }}>HK${p.total_price}</td>
                <td style={{ padding: 12 }}>{p.payment_method}</td>
                <td
                  style={{
                    padding: 12,
                    color: p.payment_status === 'completed' ? 'var(--success)' : 'var(--muted-foreground)',
                  }}
                >
                  {p.payment_status}
                </td>
                <td style={{ padding: 12 }}>{p.is_test ? '✓ Test' : ''}</td>
                <td style={{ padding: 12, fontSize: 12 }}>{new Date(p.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AuthLogTab() {
  const [events, setEvents] = useState<AuthEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const res = await fetch('/api/dev2/auth-log')
      if (res.ok) {
        const json = await res.json()
        setEvents(json.authEvents)
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ padding: 12, textAlign: 'left' }}>Timestamp</th>
              <th style={{ padding: 12, textAlign: 'left' }}>User</th>
              <th style={{ padding: 12, textAlign: 'left' }}>Action</th>
              <th style={{ padding: 12, textAlign: 'left' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: 12, fontSize: 12 }}>{new Date(e.created_at).toLocaleString()}</td>
                <td style={{ padding: 12, fontFamily: 'monospace', fontSize: 12 }}>{e.user_id.slice(0, 8)}</td>
                <td style={{ padding: 12, fontWeight: 600 }}>{e.action}</td>
                <td style={{ padding: 12, fontSize: 12, fontFamily: 'monospace' }}>
                  {JSON.stringify(e.details).slice(0, 60)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function IpWhitelistTab() {
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([])
  const [pending, setPending] = useState<PendingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [newIp, setNewIp] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const res = await fetch('/api/dev2/ip-whitelist')
      if (res.ok) {
        const json = await res.json()
        setWhitelist(json.whitelist)
        setPending(json.pending)
      }
    } finally {
      setLoading(false)
    }
  }

  async function addIp() {
    if (!newIp.trim()) return
    const res = await fetch('/api/dev2/ip-whitelist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip: newIp.trim() }),
    })
    if (res.ok) {
      setNewIp('')
      await fetchData()
    }
  }

  async function removeIp(ip: string) {
    if (!confirm(`Remove ${ip}?`)) return
    await fetch('/api/dev2/ip-whitelist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip }),
    })
    await fetchData()
  }

  async function approveIp(ip: string) {
    const label = prompt(`Approve ${ip}. Optional label:`)
    if (label === null) return
    await fetch('/api/dev2/ip-whitelist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, label }),
    })
    await fetchData()
  }

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>

  return (
    <div style={{ marginTop: 16 }}>
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Add IP</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={newIp}
            onChange={(e) => setNewIp(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addIp()}
            placeholder="192.168.1.1"
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--background)',
              color: 'var(--foreground)',
            }}
          />
          <button
            onClick={addIp}
            style={{
              padding: '8px 16px',
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Add
          </button>
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Whitelisted ({whitelist.length})</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          {whitelist.map((w) => (
            <div
              key={w.ip_address}
              style={{
                padding: 12,
                background: 'var(--muted)',
                borderRadius: 6,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{w.ip_address}</div>
                {w.label && <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{w.label}</div>}
              </div>
              <button
                onClick={() => removeIp(w.ip_address)}
                style={{
                  padding: '6px 12px',
                  background: 'var(--destructive)',
                  color: 'var(--destructive-foreground)',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Pending Requests ({pending.length})</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          {pending.map((p) => (
            <div
              key={p.ip}
              style={{
                padding: 12,
                background: 'var(--muted)',
                borderRadius: 6,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.ip}</div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                  {p.count} attempts · Last: {new Date(p.lastSeen).toLocaleString()}
                </div>
                {p.userAgent && (
                  <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>
                    {p.userAgent.slice(0, 80)}
                  </div>
                )}
              </div>
              <button
                onClick={() => approveIp(p.ip)}
                style={{
                  padding: '6px 12px',
                  background: 'var(--primary)',
                  color: 'var(--primary-foreground)',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Check size={14} /> Approve
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function DeployTab() {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [gateEnabled, setGateEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [deploying, setDeploying] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [git, env] = await Promise.all([
        fetch('/api/dev2/git-status').then((r) => r.json()),
        fetch('/api/dev2/env-info').then((r) => r.json()),
      ])
      setGitStatus(git)
      setGateEnabled(env.gateEnabled)
    } finally {
      setLoading(false)
    }
  }

  async function deploy(action: 'push' | 'maintenance' | 'go-live') {
    const confirmText = action === 'go-live' ? 'GO LIVE' : 'PUSH'
    const confirmation = prompt(`Type "${confirmText}" to confirm:`)
    if (confirmation !== confirmText) return

    setDeploying(true)
    setResult(null)
    try {
      const res = await fetch('/api/dev2/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, confirmation }),
      })
      const json = await res.json()
      if (res.ok) {
        setResult(`✓ ${json.message}`)
        await fetchData()
      } else {
        setResult(`✗ ${json.error}`)
      }
    } catch (error) {
      setResult(`✗ Deploy failed: ${error}`)
    } finally {
      setDeploying(false)
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>
  if (!gitStatus) return <div style={{ padding: 24 }}>No git status</div>

  return (
    <div style={{ marginTop: 16 }}>
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Branch Status</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ padding: 12, background: 'var(--muted)', borderRadius: 6 }}>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>UAT Branch</div>
            <div style={{ fontFamily: 'monospace', fontSize: 14 }}>
              <strong>{gitStatus.uat.sha}</strong> · {gitStatus.uat.message}
            </div>
          </div>
          <div style={{ padding: 12, background: 'var(--muted)', borderRadius: 6 }}>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 4 }}>Main Branch</div>
            <div style={{ fontFamily: 'monospace', fontSize: 14 }}>
              <strong>{gitStatus.main.sha}</strong> · {gitStatus.main.message}
            </div>
          </div>
          {gitStatus.diverged && (
            <div style={{ padding: 12, background: 'orange', color: '#000', borderRadius: 6, fontWeight: 600 }}>
              <AlertCircle size={16} style={{ display: 'inline', marginRight: 8 }} />
              Branches have diverged
            </div>
          )}
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Deploy Actions</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => deploy('push')}
            disabled={deploying}
            style={{
              padding: '12px 20px',
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              border: 'none',
              borderRadius: 6,
              cursor: deploying ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              opacity: deploying ? 0.5 : 1,
            }}
          >
            Push (uat → main, gate unchanged)
          </button>
          <button
            onClick={() => deploy('maintenance')}
            disabled={deploying}
            style={{
              padding: '12px 20px',
              background: 'orange',
              color: '#000',
              border: 'none',
              borderRadius: 6,
              cursor: deploying ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              opacity: deploying ? 0.5 : 1,
            }}
          >
            Maintenance (uat → main, gate ON)
          </button>
          {gateEnabled && (
            <button
              onClick={() => deploy('go-live')}
              disabled={deploying}
              style={{
                padding: '12px 20px',
                background: 'var(--success)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: deploying ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                opacity: deploying ? 0.5 : 1,
              }}
            >
              Go Live (open gate)
            </button>
          )}
        </div>
      </section>

      {result && (
        <div
          style={{
            padding: 16,
            background: result.startsWith('✓') ? 'var(--success)' : 'var(--destructive)',
            color: '#fff',
            borderRadius: 6,
            fontWeight: 600,
          }}
        >
          {result}
        </div>
      )}
    </div>
  )
}

function QuickActionsTab() {
  const [mode, setMode] = useState('flat')
  const [amount, setAmount] = useState('')
  const [label, setLabel] = useState('')
  const [result, setResult] = useState<string | null>(null)

  async function setTestPrice() {
    if (!amount) return
    try {
      const res = await fetch('/api/dev2/test-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, amount: parseFloat(amount), label }),
      })
      if (res.ok) {
        setResult(`✓ Test price set: ${mode} HK$${amount}`)
        setAmount('')
        setLabel('')
      } else {
        setResult('✗ Failed to set test price')
      }
    } catch (error) {
      setResult(`✗ Error: ${error}`)
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Set UAT Test Price</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--background)',
                color: 'var(--foreground)',
              }}
            >
              <option value="flat">Flat</option>
              <option value="per-hour">Per Hour</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>Amount (HK$)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--background)',
                color: 'var(--foreground)',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>Label (optional)</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Test pricing"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--background)',
                color: 'var(--foreground)',
              }}
            />
          </div>
          <button
            onClick={setTestPrice}
            style={{
              padding: '12px 20px',
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Set Test Price
          </button>
        </div>
      </section>

      {result && (
        <div
          style={{
            padding: 16,
            background: result.startsWith('✓') ? 'var(--success)' : 'var(--destructive)',
            color: '#fff',
            borderRadius: 6,
            fontWeight: 600,
          }}
        >
          {result}
        </div>
      )}

      <section style={{ marginTop: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--muted-foreground)' }}>
          More actions coming soon
        </h3>
        <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
          • Refund test booking
          <br />• Delete my test bookings
        </p>
      </section>
    </div>
  )
}
