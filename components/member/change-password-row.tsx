'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { requestResetForCurrentUser } from '@/app/reset-password/actions'

// Settings「更改密碼」row. No current-password form: it emails the same reset
// link as「忘記密碼？」to the account email, which is resolved server-side.
export function ChangePasswordRow() {
  const t = useTranslations('resetPassword')
  const tAuth = useTranslations('auth')
  const inFlight = useRef(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(id)
  }, [cooldown])

  const onClick = async () => {
    if (inFlight.current || cooldown > 0) return
    inFlight.current = true
    setBusy(true)
    setMessage(null)
    try {
      const result = await requestResetForCurrentUser()
      if (result.ok) {
        setMessage(t('settings_sent'))
        setCooldown(60)
      } else if (result.error === 'no_email') {
        setMessage(t('settings_no_email'))
      } else if (result.error === 'cooldown') {
        setMessage(t('err_cooldown'))
        setCooldown(60)
      } else if (result.error === 'rate_limited') {
        setMessage(t('err_rate_limited'))
      } else {
        setMessage(t('err_send'))
      }
    } catch {
      setMessage(t('err_send'))
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={busy || cooldown > 0}
        data-cms-key="resetPassword.settings_row"
        className="flex min-h-[44px] w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-left text-white transition-colors hover:bg-white/10 disabled:cursor-default disabled:opacity-60"
      >
        <span className="text-sm">
          {busy ? tAuth('sending') : cooldown > 0 ? t('resend_in', { seconds: cooldown }) : t('settings_row')}
        </span>
        <svg className="h-5 w-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <p data-cms-key={message ? 'resetPassword.settings_status' : 'resetPassword.settings_hint'} role="status" className="mt-2 text-xs text-white/50">
        {message ?? t('settings_hint')}
      </p>
    </div>
  )
}
