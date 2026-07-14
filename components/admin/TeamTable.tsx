'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { tokens } from '@/app/styles/tokens'
import { useAdmin } from '@/lib/admin/AdminContext'

export type TeamRow = {
  id: string
  email: string
  role: string
  invite_status: string
  invited_by_email: string | null
  created_at: string | null
}

type ToastState = { type: 'success' | 'error'; message: string }

function statusColor(status: string): string {
  if (status === 'active') return tokens.colors.brand
  if (status === 'pending') return '#eab308'
  return tokens.colors.danger
}

export default function TeamTable({ rows }: { rows: TeamRow[] }) {
  const admin = useAdmin()
  const isSuperAdmin = admin.role === 'super_admin'

  const [items, setItems] = useState(rows)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'super_admin'>('admin')
  const [inviting, setInviting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  function notify(type: ToastState['type'], message: string) {
    setToast({ type, message })
    setTimeout(() => setToast(null), 2500)
  }

  async function submitInvite() {
    setInviting(true)
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
      const json: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        const message =
          json && typeof json === 'object' && 'error' in json && typeof (json as { error: unknown }).error === 'string'
            ? (json as { error: string }).error
            : 'Invite failed'
        notify('error', message)
        return
      }
      const payload = json as { emailSent?: boolean; inviteUrl?: string }
      if (payload.emailSent === false && payload.inviteUrl) {
        notify('error', `Invite created, but email failed — share this link: ${payload.inviteUrl}`)
      } else {
        notify('success', 'Invite sent')
      }
      setItems((prev) => [
        { id: `pending-${email}`, email, role, invite_status: 'pending', invited_by_email: admin.email, created_at: null },
        ...prev.filter((r) => r.email !== email),
      ])
      setEmail('')
    } catch {
      notify('error', 'Network error')
    } finally {
      setInviting(false)
    }
  }

  async function act(id: string, body: Record<string, unknown>, onOk: () => void) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/team/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        const message =
          json && typeof json === 'object' && 'error' in json && typeof (json as { error: unknown }).error === 'string'
            ? (json as { error: string }).error
            : 'Action failed'
        notify('error', message)
        return
      }
      onOk()
      notify('success', 'Done')
    } catch {
      notify('error', 'Network error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      {isSuperAdmin && (
        <Card style={{ marginBottom: tokens.spacing.lg }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: tokens.colors.text, marginBottom: tokens.spacing.md }}>
            Invite admin
          </div>
          <div style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500, color: tokens.colors.textMuted }}>
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value === 'super_admin' ? 'super_admin' : 'admin')}
                style={{
                  height: 52,
                  padding: '0 14px',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${tokens.colors.border}`,
                  borderRadius: tokens.radius.input,
                  color: tokens.colors.text,
                  fontSize: 16,
                }}
              >
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
            <Button variant="primary" size="md" loading={inviting} disabled={!email} onClick={submitInvite}>
              Invite
            </Button>
          </div>
        </Card>
      )}

      <Card padding="0">
        {items.map((row, i) => {
          const isSelf = row.email.toLowerCase() === admin.email.toLowerCase()
          return (
            <div
              key={row.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: tokens.spacing.md,
                padding: tokens.spacing.base,
                borderBottom: i === items.length - 1 ? 'none' : `1px solid ${tokens.colors.border}`,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ color: tokens.colors.text, fontSize: 15, fontWeight: 600 }}>{row.email}</div>
                <div style={{ color: tokens.colors.textMuted, fontSize: 13 }}>
                  {row.role} · <span style={{ color: statusColor(row.invite_status) }}>{row.invite_status}</span>
                  {row.invited_by_email ? ` · invited by ${row.invited_by_email}` : ''}
                </div>
              </div>
              {isSuperAdmin && !isSelf && row.invite_status !== 'revoked' && !row.id.startsWith('pending-') && (
                <div style={{ display: 'flex', gap: tokens.spacing.sm }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={busyId === row.id}
                    onClick={() =>
                      act(row.id, { action: 'set_role', role: row.role === 'super_admin' ? 'admin' : 'super_admin' }, () =>
                        setItems((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, role: row.role === 'super_admin' ? 'admin' : 'super_admin' } : r))
                        )
                      )
                    }
                  >
                    {row.role === 'super_admin' ? 'Demote' : 'Promote'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={busyId === row.id}
                    onClick={() =>
                      act(row.id, { action: 'revoke' }, () =>
                        setItems((prev) => prev.map((r) => (r.id === row.id ? { ...r, invite_status: 'revoked' } : r)))
                      )
                    }
                  >
                    Revoke
                  </Button>
                </div>
              )}
            </div>
          )
        })}
        {items.length === 0 && (
          <div style={{ padding: tokens.spacing.lg, color: tokens.colors.textMuted, fontSize: 14 }}>No admins yet.</div>
        )}
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
              maxWidth: '90vw',
            }}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
