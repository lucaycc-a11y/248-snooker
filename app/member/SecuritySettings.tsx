'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { type MemberProfile } from '@/lib/data/memberRedesignTypes'

// ════════════════════════════════════════════════════════════════════════════
// SecuritySettings — P5: Password and phone change (email-link flow)
// No actual password change here, just trigger email with magic link
// ════════════════════════════════════════════════════════════════════════════

type Props = {
  profile: MemberProfile
}

export function SecuritySettings({ profile }: Props) {
  const t = useTranslations('member.settings.security')
  const [sendingPassword, setSendingPassword] = useState(false)
  const [sendingPhone, setSendingPhone] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [phoneSuccess, setPhoneSuccess] = useState(false)

  const handleSendPasswordEmail = async () => {
    setSendingPassword(true)
    setPasswordSuccess(false)
    try {
      const res = await fetch('/api/member/request-password-change', { method: 'POST' })
      if (res.ok) {
        setPasswordSuccess(true)
      }
    } catch {
      /* silent fail */
    } finally {
      setSendingPassword(false)
    }
  }

  const handleSendPhoneEmail = async () => {
    setSendingPhone(true)
    setPhoneSuccess(false)
    try {
      const res = await fetch('/api/member/request-phone-change', { method: 'POST' })
      if (res.ok) {
        setPhoneSuccess(true)
      }
    } catch {
      /* silent fail */
    } finally {
      setSendingPhone(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Change Password */}
      <div className="rounded-2xl bg-white/5 p-6 backdrop-blur">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-bold text-white">{t('change_password')}</h3>
            <p className="mt-1 text-sm text-white/60">{t('change_password_desc')}</p>
            {passwordSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 rounded-lg bg-green-500/20 p-3 text-sm text-green-300"
              >
                {t('email_sent')}
              </motion.div>
            )}
          </div>
          <button
            onClick={handleSendPasswordEmail}
            disabled={sendingPassword}
            className="font-label shrink-0 rounded-full bg-white/10 px-6 py-2 text-sm text-white transition-colors hover:bg-white/20 disabled:opacity-50"
          >
            {sendingPassword ? t('sending') : t('send_email')}
          </button>
        </div>
      </div>

      {/* Change Phone */}
      <div className="rounded-2xl bg-white/5 p-6 backdrop-blur">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-bold text-white">{t('change_phone')}</h3>
            <p className="mt-1 text-sm text-white/60">{t('change_phone_desc')}</p>
            {phoneSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 rounded-lg bg-green-500/20 p-3 text-sm text-green-300"
              >
                {t('email_sent')}
              </motion.div>
            )}
          </div>
          <button
            onClick={handleSendPhoneEmail}
            disabled={sendingPhone}
            className="font-label shrink-0 rounded-full bg-white/10 px-6 py-2 text-sm text-white transition-colors hover:bg-white/20 disabled:opacity-50"
          >
            {sendingPhone ? t('sending') : t('send_email')}
          </button>
        </div>
      </div>

      {/* Two-Factor Auth (placeholder) */}
      <div className="rounded-2xl bg-white/5 p-6 backdrop-blur opacity-50">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-bold text-white">{t('two_factor')}</h3>
            <p className="mt-1 text-sm text-white/60">{t('two_factor_desc')}</p>
          </div>
          <button
            disabled
            className="font-label shrink-0 rounded-full bg-white/10 px-6 py-2 text-sm text-white opacity-50"
          >
            {t('coming_soon')}
          </button>
        </div>
      </div>
    </div>
  )
}
