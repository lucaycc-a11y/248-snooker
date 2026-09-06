'use client'

import { useState } from 'react'

export function OtpPhoneUnlock() {
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function unlock() {
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/otp/unlock-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const body: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const code = body && typeof body === 'object' && 'code' in body ? String((body as { code: unknown }).code) : 'OTP_INTERNAL'
        setMessage(code === 'SUPER_ADMIN_REQUIRED' ? 'Super admin access required' : code === 'PHONE_INVALID' ? 'Enter a valid Hong Kong phone number' : 'Unable to unlock phone')
        return
      }
      const count = body && typeof body === 'object' && 'unlockedEvents' in body ? Number((body as { unlockedEvents: unknown }).unlockedEvents) : 0
      setMessage(`Phone unlocked (${Number.isFinite(count) ? count : 0} lock events cleared)`)
      setPhone('')
    } catch {
      setMessage('Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mb-8 border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      <h2 className="text-base font-semibold text-[var(--admin-text)]">Unlock OTP phone</h2>
      <p className="mt-1 text-sm text-[var(--admin-text-muted)]">Super admins can clear a temporary OTP lock.</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="min-w-[220px] flex-1 text-sm text-[var(--admin-text-muted)]">
          Hong Kong phone number
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 8))}
            inputMode="numeric"
            autoComplete="tel-national"
            className="mt-2 h-12 w-full border border-[var(--admin-border)] bg-transparent px-3 text-base text-[var(--admin-text)] outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => void unlock()}
          disabled={busy || phone.length !== 8}
          className="h-12 border border-[var(--admin-border-strong)] px-4 text-sm font-semibold text-[var(--admin-text)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Unlocking...' : 'Unlock phone'}
        </button>
      </div>
      {message && <p className="mt-3 text-sm text-[var(--admin-text-muted)]" role="status">{message}</p>}
    </section>
  )
}
