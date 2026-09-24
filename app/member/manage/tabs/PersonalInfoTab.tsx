'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'

// ════════════════════════════════════════════════════════════════════════════
// Personal Info Tab — Name, gender, phone (RO), email (RO), birthday (once)
// Birthday can only be set once (server-side enforcement)
// ════════════════════════════════════════════════════════════════════════════

type Props = {
  profile: {
    display_name: string | null
    email: string | null
    phone: string | null
    gender: string | null
    birthday: string | null
    birthday_set: boolean
  } | null
  onUpdate: () => void
}

export function PersonalInfoTab({ profile, onUpdate }: Props) {
  const supabase = createClient()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    display_name: profile?.display_name ?? '',
    gender: profile?.gender ?? '',
    birthday: profile?.birthday ?? '',
  })
  const [error, setError] = useState('')

  const handleSave = async () => {
    setSaving(true)
    setError('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    // Attempt update
    const { error: updateError } = await supabase
      .from('users')
      .update({
        display_name: form.display_name || null,
        gender: form.gender || null,
        birthday: form.birthday || null,
      })
      .eq('id', session.user.id)

    if (updateError) {
      // Server-side birthday_set enforcement will reject if already set
      if (updateError.message.includes('birthday')) {
        setError('生日只能設定一次，無法更改')
      } else {
        setError(updateError.message)
      }
      setSaving(false)
      return
    }

    setEditing(false)
    setSaving(false)
    onUpdate()
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">個人資料</h2>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#16a34a]"
            >
              編輯
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-sm text-white/50">姓名</label>
            {editing ? (
              <input
                type="text"
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-[#22c55e] focus:outline-none"
              />
            ) : (
              <p className="mt-1 text-white">{profile?.display_name ?? '未設定'}</p>
            )}
          </div>

          <div>
            <label className="text-sm text-white/50">性別</label>
            {editing ? (
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-[#22c55e] focus:outline-none"
              >
                <option value="">未設定</option>
                <option value="male">男</option>
                <option value="female">女</option>
                <option value="other">其他</option>
              </select>
            ) : (
              <p className="mt-1 text-white">
                {profile?.gender === 'male' ? '男' : profile?.gender === 'female' ? '女' : profile?.gender === 'other' ? '其他' : '未設定'}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm text-white/50">電話 (只讀)</label>
            <p className="mt-1 text-white">{profile?.phone ?? '未設定'}</p>
            <a href="/auth/change-phone" className="mt-1 text-xs text-[#22c55e] underline">
              更改電話
            </a>
          </div>

          <div>
            <label className="text-sm text-white/50">電郵 (只讀)</label>
            <p className="mt-1 text-white">{profile?.email ?? '未設定'}</p>
            <a href="/auth/change-email" className="mt-1 text-xs text-[#22c55e] underline">
              更改電郵
            </a>
          </div>

          <div>
            <label className="text-sm text-white/50">
              生日 {profile?.birthday_set && '(只能設定一次)'}
            </label>
            {editing && !profile?.birthday_set ? (
              <input
                type="date"
                value={form.birthday}
                onChange={(e) => setForm({ ...form, birthday: e.target.value })}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-[#22c55e] focus:outline-none"
              />
            ) : (
              <p className="mt-1 text-white">{profile?.birthday ?? '未設定'}</p>
            )}
            {profile?.birthday_set && (
              <p className="mt-1 text-xs text-white/40">生日已設定，無法更改</p>
            )}
          </div>
        </div>

        {editing && (
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#16a34a] disabled:opacity-50"
            >
              {saving ? '儲存中...' : '儲存'}
            </button>
            <button
              onClick={() => {
                setEditing(false)
                setError('')
                setForm({
                  display_name: profile?.display_name ?? '',
                  gender: profile?.gender ?? '',
                  birthday: profile?.birthday ?? '',
                })
              }}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              取消
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
