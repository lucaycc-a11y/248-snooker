'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { tokens } from '@/app/styles/tokens'

const LOCALES: { code: string; label: string }[] = [
  { code: 'zh-HK', label: '繁中' },
  { code: 'zh-CN', label: '简中' },
  { code: 'en', label: 'EN' },
]

const TONES: { value: 'friendly' | 'professional' | 'playful'; label: string }[] = [
  { value: 'friendly', label: 'Friendly' },
  { value: 'professional', label: 'Professional' },
  { value: 'playful', label: 'Playful' },
]

type SettingsRow = {
  locale: string
  greeting_message: string
  suggested_prompts: string[]
  system_prompt_override: string | null
  tone: 'friendly' | 'professional' | 'playful'
}

function emptyRow(locale: string): SettingsRow {
  return { locale, greeting_message: '', suggested_prompts: ['', '', '', ''], system_prompt_override: '', tone: 'friendly' }
}

export default function AiSettingsForm({ initialSettings }: { initialSettings: SettingsRow[] }) {
  const [locale, setLocale] = useState('zh-HK')
  const [rows, setRows] = useState<Record<string, SettingsRow>>(() => {
    const map: Record<string, SettingsRow> = {}
    for (const l of LOCALES) {
      const found = initialSettings.find((s) => s.locale === l.code)
      map[l.code] = found ?? emptyRow(l.code)
    }
    return map
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (saved) {
      const t = setTimeout(() => setSaved(false), 2000)
      return () => clearTimeout(t)
    }
  }, [saved])

  const row = rows[locale]

  function update(patch: Partial<SettingsRow>) {
    setRows((prev) => ({ ...prev, [locale]: { ...prev[locale], ...patch } }))
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/ai-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale: row.locale,
          greeting_message: row.greeting_message,
          suggested_prompts: row.suggested_prompts.filter((p) => p.trim()),
          system_prompt_override: row.system_prompt_override || null,
          tone: row.tone,
        }),
      })
      if (res.ok) setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: tokens.spacing.lg }}>
        {LOCALES.map((l) => (
          <button
            key={l.code}
            onClick={() => setLocale(l.code)}
            style={{
              padding: '8px 14px',
              borderRadius: tokens.radius.button,
              border: `1px solid ${locale === l.code ? tokens.colors.brand : tokens.colors.border}`,
              background: locale === l.code ? tokens.colors.brandDim : 'transparent',
              color: locale === l.code ? tokens.colors.text : tokens.colors.textMuted,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {l.label}
          </button>
        ))}
      </div>

      <Card style={{ marginBottom: tokens.spacing.lg }}>
        <div style={{ marginBottom: tokens.spacing.md }}>
          <Input
            label="Greeting message"
            value={row.greeting_message}
            onChange={(e) => update({ greeting_message: e.target.value })}
          />
        </div>

        <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500, color: tokens.colors.textMuted }}>
          Suggested prompts
        </label>
        {row.suggested_prompts.map((p, i) => (
          <div key={i} style={{ marginBottom: tokens.spacing.sm }}>
            <Input
              value={p}
              onChange={(e) => {
                const next = [...row.suggested_prompts]
                next[i] = e.target.value
                update({ suggested_prompts: next })
              }}
              placeholder={`Prompt ${i + 1}`}
            />
          </div>
        ))}
        <div style={{ display: 'flex', gap: tokens.spacing.sm, marginBottom: tokens.spacing.md }}>
          <Button variant="ghost" size="sm" onClick={() => update({ suggested_prompts: [...row.suggested_prompts, ''] })}>
            + Add prompt
          </Button>
          {row.suggested_prompts.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => update({ suggested_prompts: row.suggested_prompts.slice(0, -1) })}
            >
              Remove last
            </Button>
          )}
        </div>

        <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500, color: tokens.colors.textMuted }}>
          Tone
        </label>
        <select
          value={row.tone}
          onChange={(e) => update({ tone: e.target.value as SettingsRow['tone'] })}
          style={{
            width: '100%',
            height: 52,
            padding: '0 14px',
            marginBottom: tokens.spacing.md,
            backgroundColor: 'rgba(255,255,255,0.06)',
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: tokens.radius.input,
            color: tokens.colors.text,
            fontSize: 15,
          }}
        >
          {TONES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500, color: tokens.colors.textMuted }}>
          System prompt override (additive — layered on top of the base prompt, not a replacement)
        </label>
        <textarea
          value={row.system_prompt_override ?? ''}
          onChange={(e) => update({ system_prompt_override: e.target.value })}
          rows={4}
          style={{
            width: '100%',
            padding: 14,
            backgroundColor: 'rgba(255,255,255,0.06)',
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: tokens.radius.input,
            color: tokens.colors.text,
            fontSize: 14,
            fontFamily: tokens.font.sans,
            resize: 'vertical',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.sm, marginTop: tokens.spacing.lg }}>
          <Button variant="primary" size="md" onClick={save} loading={saving}>
            Save
          </Button>
          {saved && <span style={{ fontSize: 13, color: tokens.colors.brand }}>Saved — live immediately</span>}
        </div>
      </Card>
    </div>
  )
}
