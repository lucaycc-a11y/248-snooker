'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { type MemberProfile } from '@/lib/data/memberRedesignTypes'

// ════════════════════════════════════════════════════════════════════════════
// NotificationSettings — P5: Email/Push notification preferences
// Stored in user preferences (local state for now, can be persisted)
// ════════════════════════════════════════════════════════════════════════════

type Props = {
  profile: MemberProfile
  onRefresh: () => void
}

type NotificationPreferences = {
  email_booking_confirmed: boolean
  email_booking_reminder: boolean
  email_offers: boolean
  email_promotions: boolean
  push_booking_reminder: boolean
  push_offers: boolean
  push_system: boolean
}

export function NotificationSettings({ profile, onRefresh }: Props) {
  const t = useTranslations('member.settings.notifications')
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email_booking_confirmed: true,
    email_booking_reminder: true,
    email_offers: true,
    email_promotions: true,
    push_booking_reminder: true,
    push_offers: true,
    push_system: true,
  })
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    try {
      const res = await fetch('/api/member/notification-preferences')
      if (res.ok) {
        const data = await res.json()
        if (data.preferences) {
          setPreferences(data.preferences)
        }
      }
    } catch {
      /* use defaults */
    }
  }

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }))
    setSaveSuccess(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveSuccess(false)
    try {
      const res = await fetch('/api/member/notification-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences }),
      })
      if (res.ok) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      }
    } catch {
      /* silent fail */
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Email Notifications */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white">{t('email_notifications')}</h3>

        <ToggleRow
          label={t('booking_confirmed')}
          description={t('booking_confirmed_desc')}
          checked={preferences.email_booking_confirmed}
          onChange={() => handleToggle('email_booking_confirmed')}
        />

        <ToggleRow
          label={t('booking_reminder')}
          description={t('booking_reminder_desc')}
          checked={preferences.email_booking_reminder}
          onChange={() => handleToggle('email_booking_reminder')}
        />

        <ToggleRow
          label={t('offers')}
          description={t('offers_desc')}
          checked={preferences.email_offers}
          onChange={() => handleToggle('email_offers')}
        />

        <ToggleRow
          label={t('promotions')}
          description={t('promotions_desc')}
          checked={preferences.email_promotions}
          onChange={() => handleToggle('email_promotions')}
        />
      </div>

      {/* Push Notifications */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white">{t('push_notifications')}</h3>

        <ToggleRow
          label={t('push_booking_reminder')}
          description={t('push_booking_reminder_desc')}
          checked={preferences.push_booking_reminder}
          onChange={() => handleToggle('push_booking_reminder')}
        />

        <ToggleRow
          label={t('push_offers')}
          description={t('push_offers_desc')}
          checked={preferences.push_offers}
          onChange={() => handleToggle('push_offers')}
        />

        <ToggleRow
          label={t('push_system')}
          description={t('push_system_desc')}
          checked={preferences.push_system}
          onChange={() => handleToggle('push_system')}
        />
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="font-label rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-8 py-3 text-white transition-all hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50"
        >
          {saving ? t('saving') : t('save_preferences')}
        </button>

        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-sm font-medium text-green-400"
          >
            <span>✓</span>
            <span>{t('saved')}</span>
          </motion.div>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § TOGGLE ROW
// ────────────────────────────────────────────────────────────────────────────

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <div className="flex items-start justify-between rounded-2xl bg-white/5 p-5 backdrop-blur">
      <div className="flex-1">
        <h4 className="font-medium text-white">{label}</h4>
        <p className="mt-1 text-sm text-white/60">{description}</p>
      </div>
      <button
        onClick={onChange}
        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-gradient-to-r from-blue-500 to-cyan-500' : 'bg-white/20'
        }`}
      >
        <motion.div
          animate={{ x: checked ? 24 : 4 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="absolute top-1 h-6 w-6 rounded-full bg-white shadow-lg"
        />
      </button>
    </div>
  )
}
