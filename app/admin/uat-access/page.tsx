'use client'

import { useEffect, useState } from 'react'
import { Trash2, Plus, RefreshCw } from 'lucide-react'

type WhitelistEntry = {
  ip_address: string
  added_at: string
}

type AccessLogEntry = {
  ip_address: string
  method: 'whitelist' | 'password' | 'denied'
  pathname: string
  attempted_at: string
  user_agent: string | null
}

type Data = {
  whitelist: WhitelistEntry[]
  accessLog: AccessLogEntry[]
}

export default function UatAccessPage() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newIp, setNewIp] = useState('')
  const [adding, setAdding] = useState(false)

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/uat/ip-whitelist')
      if (!res.ok) {
        throw new Error(res.status === 401 ? 'Unauthorized' : 'Failed to fetch data')
      }
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function addIp() {
    if (!newIp.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/uat/ip-whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: newIp.trim() }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Failed to add IP')
      }
      setNewIp('')
      await fetchData()
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setAdding(false)
    }
  }

  async function removeIp(ip: string) {
    if (!confirm(`Remove ${ip} from whitelist?`)) return
    try {
      const res = await fetch('/api/uat/ip-whitelist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip }),
      })
      if (!res.ok) {
        throw new Error('Failed to remove IP')
      }
      await fetchData()
    } catch (err) {
      alert((err as Error).message)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading && !data) {
    return (
      <div style={{ padding: 24, color: 'var(--admin-text-muted)' }}>
        Loading...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 24, color: 'var(--admin-danger)' }}>
        Error: {error}
      </div>
    )
  }

  const methodColor = (method: string) => {
    switch (method) {
      case 'whitelist': return 'var(--admin-success)'
      case 'password': return 'var(--admin-info)'
      case 'denied': return 'var(--admin-danger)'
      default: return 'var(--admin-text-muted)'
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--admin-text)' }}>
            UAT Access Management
          </h1>
          <button
            onClick={fetchData}
            style={{
              padding: '8px 12px',
              background: 'var(--admin-bg-secondary)',
              border: '1px solid var(--admin-border)',
              borderRadius: 8,
              color: 'var(--admin-text)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
        <p style={{ color: 'var(--admin-text-muted)', fontSize: 14 }}>
          Manage IP whitelist and view site gate access logs
        </p>
      </div>

      {/* IP Whitelist */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--admin-text)', marginBottom: 16 }}>
          IP Whitelist
        </h2>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            type="text"
            value={newIp}
            onChange={(e) => setNewIp(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addIp()}
            placeholder="Enter IP address (e.g., 192.168.1.1)"
            disabled={adding}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: 'var(--admin-bg-secondary)',
              border: '1px solid var(--admin-border)',
              borderRadius: 8,
              color: 'var(--admin-text)',
              fontSize: 14,
            }}
          />
          <button
            onClick={addIp}
            disabled={adding || !newIp.trim()}
            style={{
              padding: '8px 16px',
              background: 'var(--admin-primary)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              cursor: adding || !newIp.trim() ? 'not-allowed' : 'pointer',
              opacity: adding || !newIp.trim() ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontWeight: 600,
            }}
          >
            <Plus size={16} />
            Add
          </button>
        </div>

        <div style={{
          background: 'var(--admin-bg-secondary)',
          border: '1px solid var(--admin-border)',
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          {!data?.whitelist.length ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--admin-text-muted)' }}>
              No IPs whitelisted
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--admin-bg-tertiary)', borderBottom: '1px solid var(--admin-border)' }}>
                  <th style={{ padding: 12, textAlign: 'left', color: 'var(--admin-text)', fontWeight: 600, fontSize: 14 }}>
                    IP Address
                  </th>
                  <th style={{ padding: 12, textAlign: 'left', color: 'var(--admin-text)', fontWeight: 600, fontSize: 14 }}>
                    Added At
                  </th>
                  <th style={{ padding: 12, textAlign: 'right', color: 'var(--admin-text)', fontWeight: 600, fontSize: 14 }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.whitelist.map((entry) => (
                  <tr key={entry.ip_address} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                    <td style={{ padding: 12, fontFamily: 'monospace', fontSize: 13, color: 'var(--admin-text)' }}>
                      {entry.ip_address}
                    </td>
                    <td style={{ padding: 12, fontSize: 13, color: 'var(--admin-text-muted)' }}>
                      {new Date(entry.added_at).toLocaleString()}
                    </td>
                    <td style={{ padding: 12, textAlign: 'right' }}>
                      <button
                        onClick={() => removeIp(entry.ip_address)}
                        style={{
                          padding: '6px 12px',
                          background: 'transparent',
                          border: '1px solid var(--admin-danger)',
                          borderRadius: 6,
                          color: 'var(--admin-danger)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 13,
                        }}
                      >
                        <Trash2 size={14} />
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Access Log */}
      <section>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--admin-text)', marginBottom: 16 }}>
          Access Log (Last 100)
        </h2>

        <div style={{
          background: 'var(--admin-bg-secondary)',
          border: '1px solid var(--admin-border)',
          borderRadius: 8,
          overflow: 'auto',
        }}>
          {!data?.accessLog.length ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--admin-text-muted)' }}>
              No access logs
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--admin-bg-tertiary)', borderBottom: '1px solid var(--admin-border)' }}>
                  <th style={{ padding: 12, textAlign: 'left', color: 'var(--admin-text)', fontWeight: 600, fontSize: 14 }}>
                    Time
                  </th>
                  <th style={{ padding: 12, textAlign: 'left', color: 'var(--admin-text)', fontWeight: 600, fontSize: 14 }}>
                    IP Address
                  </th>
                  <th style={{ padding: 12, textAlign: 'left', color: 'var(--admin-text)', fontWeight: 600, fontSize: 14 }}>
                    Method
                  </th>
                  <th style={{ padding: 12, textAlign: 'left', color: 'var(--admin-text)', fontWeight: 600, fontSize: 14 }}>
                    Path
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.accessLog.map((entry, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                    <td style={{ padding: 12, fontSize: 13, color: 'var(--admin-text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(entry.attempted_at).toLocaleString()}
                    </td>
                    <td style={{ padding: 12, fontFamily: 'monospace', fontSize: 13, color: 'var(--admin-text)' }}>
                      {entry.ip_address}
                    </td>
                    <td style={{ padding: 12, fontSize: 13, fontWeight: 600, color: methodColor(entry.method) }}>
                      {entry.method}
                    </td>
                    <td style={{ padding: 12, fontSize: 13, color: 'var(--admin-text-muted)', fontFamily: 'monospace' }}>
                      {entry.pathname}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
