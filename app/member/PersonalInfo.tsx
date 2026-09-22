'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { type MemberProfile } from '@/lib/data/memberRedesignTypes'

// ════════════════════════════════════════════════════════════════════════════
// PersonalInfo — P5: Display name, email, phone, birth month settings
// Birth month is settable once (locked forever after)
// ════════════════════════════════════════════════════════════════════════════

type Props = {
  profile: MemberProfile
  onRefresh: () => void
}

export function PersonalInfo({ profile, onRefresh }: Props) {
  const t = useTranslations('member.settings')
  const [editingBirthMonth, setEditingBirthMonth] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSaveBirthMonth = async () => {
    if (!selectedMonth) return

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/member/set-birth-month', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: selectedMonth }),
      })
      const result = await res.json()
      if (result.success) {
        setEditingBirthMonth(false)
        onRefresh()
      } else {
        setError(result.error ?? 'unknown_error')
      }
    } catch {
      setError('network_error')
    } finally {
      setSaving(false)
    }
  }

  const months = [
    { value: 1, label_zh: '一月', label_en: 'January' },
    { value: 2, label_zh: '二月', label_en: 'February' },
    { value: 3, label_zh: '三月', label_en: 'March' },
    { value: 4, label_zh: '四月', label_en: 'April' },
    { value: 5, label_zh: '五月', label_en: 'May' },
    { value: 6, label_zh: '六月', label_en: 'June' },
    { value: 7, label_zh: '七月', label_en: 'July' },
    { value: 8, label_zh: '八月', label_en: 'August' },
    { value: 9, label_zh: '九月', label_en: 'September' },
    { value: 10, label_zh: '十月', label_en: 'October' },
    { value: 11, label_zh: '十一月', label_en: 'November' },
    { value: 12, label_zh: '十二月', label_en: 'December' },
  ]

  return (
    <div className="space-y-6">
      {/* Display Name */}
      <SettingRow
        label={t('display_name')}
        value={profile.display_name ?? t('not_set')}
        editable={false}
        hint={t('display_name_hint')}
      />

      {/* Email */}
      <SettingRow
        label={t('email')}
        value={profile.email ?? t('not_set')}
        editable={false}
        hint={t('email_readonly')}
      />

      {/* Phone */}
      <SettingRow
        label={t('phone')}
        value={profile.phone ?? t('not_set')}
        editable={false}
        hint={t('phone_readonly')}
      />

      {/* Birth Month */}
      <div className="rounded-2xl bg-white/5 p-6 backdrop-blur">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <label className="text-sm font-medium text-white/60">{t('birth_month')}</label>
            {profile.birth_month ? (
              <div className="mt-2">
                <p className="text-lg font-bold text-white">
                  {months.find((m) => m.value === profile.birth_month)?.label_zh ?? profile.birth_month}
                </p>
                <p className="mt-1 text-xs text-white/40">{t('birth_month_locked')}</p>
              </div>
            ) : (
              <>
                {!editingBirthMonth ? (
                  <div className="mt-2">
                    <p className="text-white/60">{t('not_set')}</p>
                    <p className="mt-1 text-xs text-white/40">{t('birth_month_hint')}</p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                      {months.map((month) => (
                        <button
                          key={month.value}
                          onClick={() => setSelectedMonth(month.value)}
                          className={`rounded-lg px-4 py-3 text-sm font-medium transition-all ${
                            selectedMonth === month.value
                              ? 'bg-blue-500 text-white'
                              : 'bg-white/10 text-white/80 hover:bg-white/20'
                          }`}
                        >
                          {month.label_zh}
                        </button>
                      ))}
                    </div>

                    {error && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-sm text-red-400"
                      >
                        {t(`errors.${error}`)}
                      </motion.p>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={handleSaveBirthMonth}
                        disabled={!selectedMonth || saving}
                        className="font-label rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-2 text-sm text-white transition-all hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50"
                      >
                        {saving ? t('saving') : t('confirm')}
                      </button>
                      <button
                        onClick={() => {
                          setEditingBirthMonth(false)
                          setSelectedMonth(null)
                          setError(null)
                        }}
                        disabled={saving}
                        className="font-label rounded-full bg-white/10 px-6 py-2 text-sm text-white transition-colors hover:bg-white/20 disabled:opacity-50"
                      >
                        {t('cancel')}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          {!profile.birth_month && !editingBirthMonth && (
            <button
              onClick={() => setEditingBirthMonth(true)}
              className="font-label rounded-full bg-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/20"
            >
              {t('set')}
            </button>
          )}
        </div>
      </div>

      {/* Member Since */}
      <SettingRow
        label={t('member_since')}
        value={
          profile.created_at
            ? new Date(profile.created_at).toLocaleDateString('zh-HK', { year: 'numeric', month: 'long' })
            : t('not_set')
        }
        editable={false}
      />
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § SETTING ROW
// ────────────────────────────────────────────────────────────────────────────

function SettingRow({
  label,
  value,
  editable,
  hint,
}: {
  label: string
  value: string
  editable: boolean
  hint?: string
}) {
  return (
    <div className="rounded-2xl bg-white/5 p-6 backdrop-blur">
      <label className="text-sm font-medium text-white/60">{label}</label>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex-1">
          <p className="text-lg font-medium text-white">{value}</p>
          {hint && <p className="mt-1 text-xs text-white/40">{hint}</p>}
        </div>
        {editable && (
          <button className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20">
            Edit
          </button>
        )}
      </div>
    </div>
  )
}
