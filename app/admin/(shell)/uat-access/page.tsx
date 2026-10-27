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
        throw new Error(res.status === 401 ? '未有權限' : '資料載入失敗')
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
        throw new Error(json.error || '新增 IP 失敗')
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
    if (!confirm(`確定將 ${ip} 移出白名單？`)) return
    try {
      const res = await fetch('/api/uat/ip-whitelist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip }),
      })
      if (!res.ok) {
        throw new Error('移除 IP 失敗')
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
        載入中…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 24, color: 'var(--admin-danger)' }}>
        錯誤：{error}
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
            重新整理
          </button>
        </div>
        <p style={{ color: 'var(--admin-text-muted)', fontSize: 14 }}>
          管理 IP 白名單及查看網站閘門存取記錄
        </p>
      </div>

      {/* IP Whitelist */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--admin-text)', marginBottom: 16 }}>
          IP 白名單
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
            新增
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
            <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--admin-bg-tertiary)', borderBottom: '1px solid var(--admin-border)' }}>
                  <th style={{ padding: 12, textAlign: 'left', color: 'var(--admin-text)', fontWeight: 600, fontSize: 14 }}>
                    IP 位址
                  </th>
                  <th style={{ padding: 12, textAlign: 'left', color: 'var(--admin-text)', fontWeight: 600, fontSize: 14 }}>
                    新增時間
                  </th>
                  <th style={{ padding: 12, textAlign: 'right', color: 'var(--admin-text)', fontWeight: 600, fontSize: 14 }}>
                    操作
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
                        移除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      </section>

      {/* Access Log */}
      <section>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--admin-text)', marginBottom: 16 }}>
          存取記錄（最近 100 條）
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
            <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--admin-bg-tertiary)', borderBottom: '1px solid var(--admin-border)' }}>
                  <th style={{ padding: 12, textAlign: 'left', color: 'var(--admin-text)', fontWeight: 600, fontSize: 14 }}>
                    Time
                  </th>
                  <th style={{ padding: 12, textAlign: 'left', color: 'var(--admin-text)', fontWeight: 600, fontSize: 14 }}>
                    IP 位址
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
            </table></div>
          )}
        </div>
      </section>
    </div>
  )
}
