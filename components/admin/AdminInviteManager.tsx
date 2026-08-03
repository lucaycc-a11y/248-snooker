'use client'

import { useState, useEffect } from 'react'
import { Mail, X, Check, Copy, Clock } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { tokens } from '@/app/styles/tokens'

const TEXT = '#FFFFFF'
const MUTED = '#A1A1A6'
const GREEN = '#22C55E'
const DANGER = '#FF453A'
const BORDER = 'rgba(255,255,255,0.1)'
const GLASS_BG = 'rgba(255,255,255,0.05)'

type Invite = {
  id: string
  email: string
  role: string
  invite_status: string
  invite_token: string | null
  invite_expires_at: string | null
  created_at: string
}

export default function AdminInviteManager() {
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'super_admin'>('admin')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => { loadInvites() }, [])

  async function loadInvites() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/team')
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setInvites(data.members ?? [])
    } catch (e) {
      console.error('[invite] load error', e)
    } finally {
      setLoading(false)
    }
  }

  async function sendInvite() {
    setError(null)
    if (!email.trim()) {
      setError('Email is required')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to send invite')
        return
      }
      setEmail('')
      loadInvites()
    } catch (e) {
      setError('Failed to send invite')
    } finally {
      setSending(false)
    }
  }

  async function revokeInvite(id: string) {
    const res = await fetch(`/api/admin/team/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_status: 'revoked' }),
    })
    if (res.ok) loadInvites()
  }

  function copyInviteUrl(invite: Invite) {
    if (!invite.invite_token) return
    const url = `https://space8.com.hk/admin/accept-invite?token=${invite.invite_token}`
    navigator.clipboard.writeText(url)
    setCopiedId(invite.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const pendingInvites = invites.filter((i) => i.invite_status === 'pending')
  const activeInvites = invites.filter((i) => i.invite_status === 'active')

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: TEXT, marginBottom: 16 }}>Admin Invites</h2>

      {/* Send invite form */}
      <Card variant="gradient" style={{ padding: '20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: 12, color: MUTED, marginBottom: 4, display: 'block' }}>Email</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" type="email" />
          </div>
          <div style={{ minWidth: 120 }}>
            <label style={{ fontSize: 12, color: MUTED, marginBottom: 4, display: 'block' }}>Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'super_admin')}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 12, border: `1px solid ${BORDER}`,
                background: GLASS_BG, color: TEXT, fontSize: 14,
              }}
            >
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          <Button variant="primary" onClick={sendInvite} disabled={sending}>
            <Mail size={16} style={{ marginRight: 6 }} />
            {sending ? 'Sending...' : 'Send Invite'}
          </Button>
        </div>
        {error && <p style={{ color: DANGER, fontSize: 13, marginTop: 8 }}>{error}</p>}
      </Card>

      {loading ? (
        <p style={{ color: MUTED, fontSize: 14 }}>Loading...</p>
      ) : (
        <>
          {/* Pending invites */}
          {pendingInvites.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, color: MUTED, marginBottom: 8 }}>
                Pending Invites ({pendingInvites.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingInvites.map((invite) => (
                  <Card key={invite.id} variant="gradient" style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{invite.email}</div>
                        <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                          {invite.role} · Expires {invite.invite_expires_at ? new Date(invite.invite_expires_at).toLocaleString() : 'N/A'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {invite.invite_token && (
                          <button
                            type="button"
                            onClick={() => copyInviteUrl(invite)}
                            style={{ background: 'none', border: 'none', color: GREEN, cursor: 'pointer', fontSize: 13 }}
                            title="Copy invite link"
                          >
                            {copiedId === invite.id ? <Check size={16} /> : <Copy size={16} />}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => revokeInvite(invite.id)}
                          style={{ background: 'none', border: 'none', color: DANGER, cursor: 'pointer', fontSize: 13 }}
                          title="Revoke"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Active admins */}
          <div>
            <h3 style={{ fontSize: 15, color: MUTED, marginBottom: 8 }}>
              Active Admins ({activeInvites.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activeInvites.map((invite) => (
                <Card key={invite.id} variant="gradient" style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{invite.email}</div>
                      <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                        {invite.role} · Active since {new Date(invite.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 999,
                      background: 'rgba(34,197,94,0.15)', color: GREEN,
                    }}>
                      Active
                    </span>
                  </div>
                </Card>
              ))}
              {activeInvites.length === 0 && (
                <p style={{ color: MUTED, fontSize: 14 }}>No active admins.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}