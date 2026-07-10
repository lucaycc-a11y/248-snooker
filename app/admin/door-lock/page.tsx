'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { tokens } from '@/app/styles/tokens'
import { Lock, Unlock, RefreshCw, QrCode, CreditCard, Key, AlertTriangle } from 'lucide-react'

type DeviceStatus = {
  device_id: string
  last_seen: string
  status: 'online' | 'offline'
}

type RelayStatus = {
  table_number: number
  relay_gpio: number
  label: string
}

type AccessLog = {
  id: string
  device_id: string
  method: string
  identifier: string
  result: string
  reason: string | null
  created_at: string
}

type LockoutStatus = {
  device_id: string
  scope: string
  attempt_count: number
  locked_until: string | null
}

export default function DoorLockPage() {
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null)
  const [relays, setRelays] = useState<RelayStatus[]>([])
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([])
  const [lockouts, setLockouts] = useState<LockoutStatus[]>([])
  const [passwords, setPasswords] = useState<Record<string, string>>({})
  const [adminQR, setAdminQR] = useState<{ qr_code: string; expires_at: string } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 10000) // 每10秒刷新
    return () => clearInterval(interval)
  }, [])

  async function loadData() {
    try {
      const token = localStorage.getItem('supabase.auth.token')
      const res = await fetch('/api/admin/door-status', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      const data = await res.json()
      if (data.success) {
        setDeviceStatus(data.device_status)
        setRelays(data.relays)
        setAccessLogs(data.access_logs)
        setLockouts(data.lockouts)
      }
    } catch (err) {
      console.error('Load data error:', err)
    }
  }

  async function handleOpenDoor(scope: string, tables: number[]) {
    setLoading(true)
    try {
      const token = localStorage.getItem('supabase.auth.token')
      const res = await fetch('/api/door/admin-override', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'open_door',
          device_id: 'main_door',
          scope,
          tables,
        }),
      })

      const data = await res.json()
      if (data.success) {
        alert('門已打開')
      } else {
        alert('操作失敗: ' + data.error)
      }
    } catch (err) {
      console.error('Open door error:', err)
      alert('操作失敗')
    } finally {
      setLoading(false)
    }
  }

  async function handleRotateSecret(scope: string) {
    if (!confirm(`確定要重新生成 ${scope} 的密碼？此操作不可逆轉。`)) {
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem('supabase.auth.token')
      const res = await fetch('/api/door/admin-override', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'rotate_secret',
          device_id: 'main_door',
          scope,
        }),
      })

      const data = await res.json()
      if (data.success) {
        alert('密碼已重新生成')
        loadPasswords()
      } else {
        alert('操作失敗: ' + data.error)
      }
    } catch (err) {
      console.error('Rotate secret error:', err)
      alert('操作失敗')
    } finally {
      setLoading(false)
    }
  }

  async function loadPasswords() {
    setLoading(true)
    try {
      const scopes = ['main_door', 'table_1', 'table_2']
      const results: Record<string, string> = {}

      for (const scope of scopes) {
        const res = await fetch('/api/door/backup-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: process.env.NEXT_PUBLIC_DOOR_API_KEY || '',
            device_id: 'main_door',
            scope,
          }),
        })

        const data = await res.json()
        if (data.success) {
          results[scope] = data.password
        }
      }

      setPasswords(results)
    } catch (err) {
      console.error('Load passwords error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateQR() {
    setLoading(true)
    try {
      const token = localStorage.getItem('supabase.auth.token')
      const res = await fetch('/api/admin/generate-qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      const data = await res.json()
      if (data.qr_code) {
        setAdminQR(data)
      } else {
        alert('生成失敗: ' + data.error)
      }
    } catch (err) {
      console.error('Generate QR error:', err)
      alert('生成失敗')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: tokens.colors.text, marginBottom: 24 }}>
        Door Lock System
      </h1>

      {/* Device Status */}
      <Card variant="gradient" style={{ marginBottom: tokens.spacing.lg }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: tokens.colors.text, marginBottom: 16 }}>
          Device Status
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: deviceStatus?.status === 'online' ? tokens.colors.success : tokens.colors.error,
            }}
          />
          <span style={{ color: tokens.colors.textMuted }}>
            {deviceStatus?.status === 'online' ? 'Online' : 'Offline'}
            {deviceStatus?.last_seen && ` • Last seen: ${new Date(deviceStatus.last_seen).toLocaleString()}`}
          </span>
        </div>
      </Card>

      {/* Quick Actions */}
      <Card variant="gradient" style={{ marginBottom: tokens.spacing.lg }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: tokens.colors.text, marginBottom: 16 }}>
          Quick Actions
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <button
            onClick={() => handleOpenDoor('main_door', [])}
            disabled={loading}
            style={{
              padding: '12px 16px',
              background: tokens.colors.accent,
              color: '#fff',
              border: 'none',
              borderRadius: tokens.radius.md,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Unlock size={18} />
            Open Main Door
          </button>
          <button
            onClick={() => handleOpenDoor('table_1', [1])}
            disabled={loading}
            style={{
              padding: '12px 16px',
              background: tokens.colors.accent,
              color: '#fff',
              border: 'none',
              borderRadius: tokens.radius.md,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Unlock size={18} />
            Open Table 1
          </button>
          <button
            onClick={() => handleOpenDoor('table_2', [2])}
            disabled={loading}
            style={{
              padding: '12px 16px',
              background: tokens.colors.accent,
              color: '#fff',
              border: 'none',
              borderRadius: tokens.radius.md,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Unlock size={18} />
            Open Table 2
          </button>
        </div>
      </Card>

      {/* Backup Passwords */}
      <Card variant="gradient" style={{ marginBottom: tokens.spacing.lg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: tokens.colors.text }}>
            Backup Passwords (TOTP)
          </div>
          <button
            onClick={loadPasswords}
            disabled={loading}
            style={{
              padding: '8px 12px',
              background: tokens.colors.accentMuted,
              color: tokens.colors.accent,
              border: 'none',
              borderRadius: tokens.radius.sm,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Key size={16} />
            Load Passwords
          </button>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          {['main_door', 'table_1', 'table_2'].map((scope) => (
            <div
              key={scope}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 12,
                background: tokens.colors.bgSecondary,
                borderRadius: tokens.radius.sm,
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: tokens.colors.text }}>
                  {scope === 'main_door' ? 'Main Door' : scope === 'table_1' ? 'Table 1' : 'Table 2'}
                </div>
                <div style={{ fontSize: 24, fontFamily: 'monospace', color: tokens.colors.accent, marginTop: 4 }}>
                  {passwords[scope] || '------'}
                </div>
              </div>
              <button
                onClick={() => handleRotateSecret(scope)}
                disabled={loading}
                style={{
                  padding: '6px 10px',
                  background: 'transparent',
                  color: tokens.colors.textMuted,
                  border: `1px solid ${tokens.colors.border}`,
                  borderRadius: tokens.radius.sm,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <RefreshCw size={14} />
                Rotate
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Admin QR Code */}
      <Card variant="gradient" style={{ marginBottom: tokens.spacing.lg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: tokens.colors.text }}>
            Admin QR Code
          </div>
          <button
            onClick={handleGenerateQR}
            disabled={loading}
            style={{
              padding: '8px 12px',
              background: tokens.colors.accentMuted,
              color: tokens.colors.accent,
              border: 'none',
              borderRadius: tokens.radius.sm,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <QrCode size={16} />
            Generate New QR
          </button>
        </div>
        {adminQR && (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                display: 'inline-block',
                padding: 16,
                background: '#fff',
                borderRadius: tokens.radius.md,
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 14, fontFamily: 'monospace', color: '#000' }}>
                {adminQR.qr_code}
              </div>
            </div>
            <div style={{ fontSize: 14, color: tokens.colors.textMuted }}>
              Expires: {new Date(adminQR.expires_at).toLocaleString()}
            </div>
          </div>
        )}
      </Card>

      {/* Lockout Status */}
      {lockouts.length > 0 && (
        <Card variant="gradient" style={{ marginBottom: tokens.spacing.lg }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: tokens.colors.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={20} color={tokens.colors.warning} />
            Lockout Alerts
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {lockouts.map((lockout) => (
              <div
                key={`${lockout.device_id}-${lockout.scope}`}
                style={{
                  padding: 12,
                  background: tokens.colors.bgSecondary,
                  borderRadius: tokens.radius.sm,
                  borderLeft: `4px solid ${tokens.colors.warning}`,
                }}
              >
                <div style={{ fontWeight: 600, color: tokens.colors.text }}>
                  {lockout.scope} • {lockout.attempt_count} attempts
                </div>
                {lockout.locked_until && (
                  <div style={{ fontSize: 14, color: tokens.colors.textMuted, marginTop: 4 }}>
                    Locked until: {new Date(lockout.locked_until).toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Access Logs */}
      <Card variant="gradient">
        <div style={{ fontSize: 18, fontWeight: 700, color: tokens.colors.text, marginBottom: 16 }}>
          Recent Access Logs
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {accessLogs.slice(0, 10).map((log) => (
            <div
              key={log.id}
              style={{
                padding: 10,
                background: tokens.colors.bgSecondary,
                borderRadius: tokens.radius.sm,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <span style={{ color: tokens.colors.text, fontWeight: 600 }}>
                  {log.method}
                </span>
                <span style={{ color: tokens.colors.textMuted, marginLeft: 8 }}>
                  {log.identifier}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: tokens.radius.sm,
                    fontSize: 12,
                    fontWeight: 600,
                    background: log.result === 'success' ? tokens.colors.successMuted : tokens.colors.errorMuted,
                    color: log.result === 'success' ? tokens.colors.success : tokens.colors.error,
                  }}
                >
                  {log.result}
                </span>
                <span style={{ fontSize: 12, color: tokens.colors.textMuted }}>
                  {new Date(log.created_at).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </main>
  )
}
