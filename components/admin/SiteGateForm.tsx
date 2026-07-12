'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { tokens } from '@/app/styles/tokens'
import type { SiteGateWhitelistRow } from '@/lib/data/getAdminSiteGate'

type ToastState = { type: 'success' | 'error'; message: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function errorMessage(json: unknown, fallback: string): string {
  return isRecord(json) && typeof json.error === 'string' ? json.error : fallback
}

export default function SiteGateForm({
  initialEnabled,
  initialHasPassword,
  initialWhitelist,
}: {
  initialEnabled: boolean
  initialHasPassword: boolean
  initialWhitelist: SiteGateWhitelistRow[]
}) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [hasPassword, setHasPassword] = useState(initialHasPassword)
  const [toggling, setToggling] = useState(false)
  const [settingPassword, setSettingPassword] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [whitelist, setWhitelist] = useState(initialWhitelist)
  const [newIp, setNewIp] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [addingIp, setAddingIp] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  function notify(type: ToastState['type'], message: string) {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }

  async function toggleEnabled() {
    setToggling(true)
    try {
      const res = await fetch('/api/admin/site-gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', enabled: !enabled }),
      })
      const json: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        notify('error', errorMessage(json, 'Failed to update'))
        return
      }
      setEnabled(!enabled)
      notify('success', !enabled ? 'Gate enabled' : 'Gate disabled')
    } catch {
      notify('error', 'Network error')
    } finally {
      setToggling(false)
    }
  }

  async function setPassword() {
    const password = passwordInput.trim()
    if (password.length < 6) {
      notify('error', 'Password must be at least 6 characters')
      return
    }
    setSettingPassword(true)
    try {
      const res = await fetch('/api/admin/site-gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_password', password }),
      })
      const json: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        notify('error', errorMessage(json, 'Failed to set password'))
        return
      }
      setPasswordInput('')
      setHasPassword(true)
      notify('success', 'Password updated')
    } catch {
      notify('error', 'Network error')
    } finally {
      setSettingPassword(false)
    }
  }

  async function addIp() {
    const ip = newIp.trim()
    if (!ip) return
    setAddingIp(true)
    try {
      const res = await fetch('/api/admin/site-gate/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ipAddress: ip, label: newLabel.trim() || null }),
      })
      const json: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        notify('error', errorMessage(json, 'Failed to add IP'))
        return
      }
      const row = isRecord(json) && isRecord(json.row) ? json.row : null
      if (row && typeof row.id === 'string') {
        setWhitelist((prev) => [
          {
            id: row.id as string,
            ipAddress: String(row.ip_address ?? ip),
            label: (row.label as string | null) ?? null,
            createdAt: (row.created_at as string | null) ?? null,
          },
          ...prev,
        ])
      }
      setNewIp('')
      setNewLabel('')
      notify('success', 'IP added')
    } catch {
      notify('error', 'Network error')
    } finally {
      setAddingIp(false)
    }
  }

  async function removeIp(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/site-gate/whitelist/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json: unknown = await res.json().catch(() => null)
        notify('error', errorMessage(json, 'Failed to remove'))
        return
      }
      setWhitelist((prev) => prev.filter((r) => r.id !== id))
      notify('success', 'Removed')
    } catch {
      notify('error', 'Network error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <Card style={{ marginBottom: tokens.spacing.lg }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: tokens.spacing.md }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: tokens.colors.text }}>Coming soon gate</div>
            <div style={{ fontSize: 13, color: tokens.colors.textMuted, marginTop: 4 }}>
              {enabled ? 'Visitors see the coming-soon page unless whitelisted or unlocked.' : 'Gate is off — site is fully public.'}
            </div>
          </div>
          <Button variant={enabled ? 'secondary' : 'primary'} size="sm" loading={toggling} onClick={toggleEnabled}>
            {enabled ? 'Disable' : 'Enable'}
          </Button>
        </div>
      </Card>

      <Card style={{ marginBottom: tokens.spacing.lg }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: tokens.colors.text, marginBottom: tokens.spacing.sm }}>
          Gate password
        </div>
        <div style={{ fontSize: 13, color: tokens.colors.textMuted, marginBottom: tokens.spacing.md }}>
          {hasPassword ? 'A password is set.' : 'No password set yet.'} Setting a new one immediately invalidates the previous one.
        </div>
        <div style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <Input
              label="New password"
              placeholder="At least 6 characters"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            size="md"
            loading={settingPassword}
            disabled={passwordInput.trim().length < 6}
            onClick={setPassword}
          >
            Confirm
          </Button>
        </div>
      </Card>

      <Card>
        <div style={{ fontSize: 16, fontWeight: 700, color: tokens.colors.text, marginBottom: tokens.spacing.md }}>
          IP whitelist
        </div>
        <div style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: tokens.spacing.md }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <Input label="IP address" placeholder="203.0.113.1" value={newIp} onChange={(e) => setNewIp(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <Input label="Label" placeholder="e.g. Office" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          </div>
          <Button variant="primary" size="md" loading={addingIp} disabled={!newIp.trim()} onClick={addIp}>
            Add
          </Button>
        </div>
        <div>
          {whitelist.map((row, i) => (
            <div
              key={row.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: tokens.spacing.md,
                padding: `${tokens.spacing.sm} 0`,
                borderBottom: i === whitelist.length - 1 ? 'none' : `1px solid ${tokens.colors.border}`,
              }}
            >
              <div>
                <div style={{ color: tokens.colors.text, fontSize: 15, fontFamily: 'monospace' }}>{row.ipAddress}</div>
                {row.label && <div style={{ color: tokens.colors.textMuted, fontSize: 13 }}>{row.label}</div>}
              </div>
              <Button variant="ghost" size="sm" loading={busyId === row.id} onClick={() => removeIp(row.id)} style={{ color: tokens.colors.danger }}>
                Remove
              </Button>
            </div>
          ))}
          {whitelist.length === 0 && (
            <div style={{ color: tokens.colors.textMuted, fontSize: 14 }}>No whitelisted IPs yet.</div>
          )}
        </div>
      </Card>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              top: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              background: tokens.colors.surfaceElevated,
              border: `1px solid ${toast.type === 'error' ? tokens.colors.danger : tokens.colors.borderStrong}`,
              borderRadius: tokens.radius.button,
              padding: '12px 20px',
              fontSize: 14,
              color: tokens.colors.text,
              zIndex: 1000,
            }}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
