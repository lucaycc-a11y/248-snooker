'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/admin/ui/Button'
import { Input } from '@/components/ui/input'
import { tokens } from '@/app/styles/tokens'
import { useNfcRegistrationStatus } from '@/lib/door/useNfcRegistrationStatus'
import type { DoorCardRow } from '@/lib/data/getAdminDoorCards'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export default function DoorCardTable({ initial }: { initial: DoorCardRow[] }) {
  const [cards, setCards] = useState(initial)
  const [registering, setRegistering] = useState(false)
  const [requestId, setRequestId] = useState<string | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [confirmLabel, setConfirmLabel] = useState('')
  const [busy, setBusy] = useState(false)

  const { status, uid } = useNfcRegistrationStatus(requestId)

  async function startRegistration() {
    const label = newLabel.trim()
    if (!label) return
    setBusy(true)
    try {
      const res = await fetch('/api/admin/door/register-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      })
      const json: unknown = await res.json().catch(() => null)
      const id = isRecord(json) && typeof json.id === 'string' ? json.id : null
      if (res.ok && id) {
        setConfirmLabel(label)
        setRequestId(id)
      }
    } finally {
      setBusy(false)
    }
  }

  async function cancelRegistration() {
    const id = requestId
    setRequestId(null)
    setRegistering(false)
    setNewLabel('')
    if (id) {
      await fetch(`/api/admin/door/register-request/${id}/cancel`, { method: 'POST' }).catch(() => {})
    }
  }

  async function confirmRegistration() {
    const label = confirmLabel.trim()
    if (!requestId || !label) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/door/register-request/${requestId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      })
      const json: unknown = await res.json().catch(() => null)
      const card = isRecord(json) && isRecord(json.card) ? json.card : null
      if (
        res.ok &&
        card &&
        typeof card.id === 'string' &&
        typeof card.uid === 'string' &&
        typeof card.label === 'string'
      ) {
        setCards((prev) => [
          { id: card.id as string, uid: card.uid as string, label: card.label as string, active: Boolean(card.active), createdAt: null, createdBy: null },
          ...prev,
        ])
        setRequestId(null)
        setRegistering(false)
        setNewLabel('')
      }
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(id: string, active: boolean) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, active } : c)))
    await fetch(`/api/admin/door/cards/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    }).catch(() => {})
  }

  async function deleteCard(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id))
    await fetch(`/api/admin/door/cards/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  return (
    <div>
      <Card className="p-0" style={{ marginBottom: tokens.spacing.lg }}>
        {cards.map((c, i) => (
          <div
            key={c.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: tokens.spacing.md,
              padding: tokens.spacing.base,
              borderBottom: i === cards.length - 1 ? 'none' : `1px solid ${tokens.colors.border}`,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ color: tokens.colors.text, fontSize: 15, fontWeight: 600 }}>{c.label}</div>
              <div style={{ color: tokens.colors.textMuted, fontSize: 13 }}>
                UID {c.uid} · {c.active ? 'Active' : 'Disabled'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: tokens.spacing.sm }}>
              <Button variant="secondary" onClick={() => toggleActive(c.id, !c.active)}>
                {c.active ? 'Disable' : 'Enable'}
              </Button>
              <Button variant="danger" onClick={() => deleteCard(c.id)}>
                Delete
              </Button>
            </div>
          </div>
        ))}
        {cards.length === 0 && (
          <div style={{ padding: tokens.spacing.lg, color: tokens.colors.textMuted, fontSize: 14 }}>
            No staff cards registered yet.
          </div>
        )}
      </Card>

      <Card style={{ padding: tokens.spacing.base }}>
        {!registering ? (
          <Button variant="secondary" onClick={() => setRegistering(true)}>
            + Register new card
          </Button>
        ) : !requestId ? (
          <div>
            <div style={{ marginBottom: tokens.spacing.sm }}>
              <Input

                placeholder="e.g. Front desk staff card"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') startRegistration()
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: tokens.spacing.sm }}>
              <Button variant="primary" disabled={busy} onClick={startRegistration}>
                {busy ? 'Starting...' : 'Start'}
              </Button>
              <Button variant="secondary" onClick={() => setRegistering(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : status === 'pending' ? (
          <div>
            <div style={{ color: tokens.colors.text, fontSize: 15, fontWeight: 600, marginBottom: tokens.spacing.sm }}>
              Waiting for card tap...
            </div>
            <div style={{ color: tokens.colors.textMuted, fontSize: 13, marginBottom: tokens.spacing.sm }}>
              Tap the new card on the door reader now.
            </div>
            <Button variant="secondary" onClick={cancelRegistration}>
              Cancel
            </Button>
          </div>
        ) : status === 'scanned' ? (
          <div>
            <div style={{ color: tokens.colors.text, fontSize: 15, fontWeight: 600, marginBottom: tokens.spacing.sm }}>
              Card detected — UID {uid}
            </div>
            <div style={{ marginBottom: tokens.spacing.sm }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500, color: tokens.colors.textMuted }}>Confirm label</label>
          <Input value={confirmLabel} onChange={(e) => setConfirmLabel(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: tokens.spacing.sm }}>
              <Button variant="primary" disabled={busy} onClick={confirmRegistration}>
                {busy ? 'Confirming...' : 'Confirm'}
              </Button>
              <Button variant="secondary" onClick={cancelRegistration}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ color: tokens.colors.danger, fontSize: 14, marginBottom: tokens.spacing.sm }}>
              Registration {status}. Please try again.
            </div>
            <Button variant="secondary" onClick={cancelRegistration}>
              Close
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
