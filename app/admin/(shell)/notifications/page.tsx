'use client'

/**
 * Admin Notification Templates — §11.3.
 *
 * CRUD for notification templates with live preview.
 * Supports variables in {{variable}} syntax with sample value replacement.
 * Channels: push, email, sms, in_app.
 *
 * Design system: admin-theme.css variables only.
 * NO inline hex, NO shadows, NO `any`.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'

/* ── Types ────────────────────────────────────────────── */
type Template = {
  id: string
  name: string
  channel: string
  subject: string | null
  body: string
  variables: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

type FormData = {
  name: string
  channel: string
  subject: string
  body: string
  variables: string[]
  is_active: boolean
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/* ── Channel config ───────────────────────────────────── */
const CHANNELS: Record<string, { label: string; tone?: 'warn' | 'muted' }> = {
  push: { label: '推送' },
  email: { label: '電郵', tone: 'warn' },
  sms: { label: '短訊' },
  in_app: { label: '站內', tone: 'muted' },
}

/* ── Extract variables from body ──────────────────────── */
function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g) ?? []
  return [...new Set(matches.map((m) => m.slice(2, -2)))]
}

/* ── Render preview with sample values ────────────────── */
function renderPreview(text: string, sampleValues: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return sampleValues[key] ?? `[${key}]`
  })
}

/* ── Default sample values ────────────────────────────── */
const SAMPLE_VALUES: Record<string, string> = {
  user_name: 'Chen Wei',
  booking_code: 'S8-240815-001',
  venue_name: 'Space8 Causeway Bay',
  date: '2026-09-01',
  time: '14:00–16:00',
  amount: 'HK$280',
  tier: 'Platinum',
  points: '1,250',
  room: 'Room A',
  cancellation_reason: 'Schedule conflict',
  admin_name: 'Admin',
  message: 'Thank you for your booking!',
}

const EMPTY_FORM: FormData = {
  name: '',
  channel: 'push',
  subject: '',
  body: '',
  variables: [],
  is_active: true,
}

/* ── Main component ─────────────────────────────────── */
export default function NotificationsPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [variableInputs, setVariableInputs] = useState<Record<string, string>>(SAMPLE_VALUES)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null)

  /* ── Fetch templates ─────────────────────────────────── */
  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/notifications')
      const data: unknown = await res.json()
      if (isRecord(data) && Array.isArray(data.templates)) {
        setTemplates(data.templates as Template[])
      } else {
        setTemplates([])
      }
    } catch {
      setError('範本載入失敗')
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  /* ── Auto-detect variables from body ────────────────── */
  const detectedVariables = useMemo(() => extractVariables(form.body), [form.body])

  /* ── Preview rendered body ──────────────────────────── */
  const previewBody = useMemo(
    () => renderPreview(form.body, variableInputs),
    [form.body, variableInputs],
  )
  const previewSubject = useMemo(
    () => form.subject ? renderPreview(form.subject, variableInputs) : null,
    [form.subject, variableInputs],
  )

  /* ── Open create form ────────────────────────────────── */
  const handleCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setVariableInputs(SAMPLE_VALUES)
    setShowForm(true)
  }

  /* ── Open edit form ──────────────────────────────────── */
  const handleEdit = (t: Template) => {
    setEditingId(t.id)
    setForm({
      name: t.name,
      channel: t.channel,
      subject: t.subject ?? '',
      body: t.body,
      variables: t.variables,
      is_active: t.isActive,
    })
    setVariableInputs(SAMPLE_VALUES)
    setShowForm(true)
  }

  /* ── Save (create or update) ─────────────────────────── */
  const handleSave = useCallback(async () => {
    if (!form.name.trim() || !form.body.trim()) {
      setError('請填寫名稱與內容')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        channel: form.channel,
        subject: form.subject.trim() || null,
        body: form.body.trim(),
        variables: detectedVariables,
        is_active: form.is_active,
      }

      if (editingId) {
        payload.id = editingId
        const res = await fetch('/api/admin/notifications', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Update failed')
      } else {
        const res = await fetch('/api/admin/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Create failed')
      }

      setShowForm(false)
      setEditingId(null)
      setForm(EMPTY_FORM)
      await fetchTemplates()
    } catch {
      setError(editingId ? '範本更新失敗' : '範本建立失敗')
    } finally {
      setSaving(false)
    }
  }, [form, editingId, detectedVariables, fetchTemplates])

  /* ── Delete template ─────────────────────────────────── */
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/notifications?id=${deleteTarget.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setDeleteTarget(null)
      await fetchTemplates()
    } catch {
      setError('範本刪除失敗')
    } finally {
      setSaving(false)
    }
  }, [deleteTarget, fetchTemplates])

  /* ── Toggle active ───────────────────────────────────── */
  const handleToggleActive = useCallback(async (t: Template) => {
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id, is_active: !t.isActive }),
      })
      if (!res.ok) throw new Error('Toggle failed')
      await fetchTemplates()
    } catch {
      setError('範本狀態更新失敗')
    }
  }, [fetchTemplates])

  const activeCount = templates.filter((x) => x.isActive).length

  return (
    <div className="admin-stack">
      <section className="admin-card">
        <div className="ad-filters" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <p className="ad-muted" style={{ margin: 0 }}>
            管理推播、電郵、短訊與站內通知範本
            {!loading && templates.length > 0 ? ` · 共 ${templates.length} 個，${activeCount} 個啟用` : ''}
          </p>
          <button type="button" className="ad-btn ad-btn-primary" onClick={handleCreate}>新增範本</button>
        </div>
      </section>

      {error ? (
        <div role="alert" className="admin-card" style={{ borderColor: 'var(--admin-status-danger)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', gap: 12, color: 'var(--admin-status-danger)' }}>
          <span>{error}</span>
          <button type="button" className="ad-muted" onClick={() => setError(null)}>關閉</button>
        </div>
      ) : null}

      {showForm ? (
        <section className="admin-card">
          <div className="admin-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>{editingId ? '編輯範本' : '新增範本'}</h3>
            <button type="button" className="ad-btn" onClick={() => { setShowForm(false); setEditingId(null) }}>取消</button>
          </div>

          <div className="grid gap-6 md:grid-cols-2" style={{ padding: '4px 20px 20px' }}>
            <div className="flex flex-col gap-4">
              <label className="ad-field" style={{ flex: 'none' }}>
                <span>範本名稱</span>
                <input className="ad-input" type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="例如預約確認" />
              </label>

              <div className="ad-field" style={{ flex: 'none' }}>
                <span>發送渠道</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(CHANNELS).map(([key, cfg]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, channel: key }))}
                      className={form.channel === key ? 'ad-btn ad-btn-primary' : 'ad-btn'}
                      aria-pressed={form.channel === key}
                    >
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              {form.channel === 'email' ? (
                <label className="ad-field" style={{ flex: 'none' }}>
                  <span>主旨</span>
                  <input className="ad-input" type="text" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="例如：你在 {{venue_name}} 的預約已確認" />
                </label>
              ) : null}

              <label className="ad-field" style={{ flex: 'none' }}>
                <span>範本內容</span>
                <textarea
                  className="ad-input"
                  style={{ minHeight: 140, padding: '12px 14px', resize: 'vertical', lineHeight: 1.6 }}
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  placeholder="使用 {{variable_name}} 插入動態內容…"
                  rows={6}
                />
                <span style={{ fontWeight: 400 }}>
                  用 {'{{variable_name}}'} 插入動態內容。偵測到：{detectedVariables.length > 0 ? detectedVariables.join(', ') : '無'}
                </span>
              </label>

              <div className="tm-row" style={{ padding: 0, border: 0 }}>
                <span style={{ fontWeight: 600 }}>啟用</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.is_active}
                  aria-label="啟用範本"
                  className="tm-switch"
                  data-on={form.is_active}
                  onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                >
                  <span className="tm-knob" />
                </button>
              </div>

              <button
                type="button"
                className="ad-btn ad-btn-primary"
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.body.trim()}
              >
                {saving ? '儲存中…' : editingId ? '更新範本' : '建立範本'}
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="ad-field" style={{ flex: 'none' }}>
                <span>範例數值</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 14, background: 'var(--admin-bg-tile)' }}>
                  {detectedVariables.map((v) => (
                    <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="ad-mono" style={{ minWidth: 110, color: 'var(--admin-green)' }}>{'{{' + v + '}}'}</span>
                      <input
                        className="ad-input"
                        style={{ minHeight: 38 }}
                        type="text"
                        value={variableInputs[v] ?? ''}
                        onChange={(e) => setVariableInputs((prev) => ({ ...prev, [v]: e.target.value }))}
                      />
                    </label>
                  ))}
                  {detectedVariables.length === 0 ? <p className="ad-muted" style={{ margin: 0 }}>內容中未偵測到變數</p> : null}
                </div>
              </div>

              <div className="ad-field" style={{ flex: 'none' }}>
                <span>即時預覽</span>
                <div style={{ padding: 16, borderRadius: 18, background: 'var(--admin-bg-tile)', border: '1px solid var(--admin-border-subtle)' }}>
                  {previewSubject ? <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 16 }}>{previewSubject}</p> : null}
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.65, fontWeight: 400, color: 'var(--admin-text-primary)' }}>
                    {previewBody || '開始輸入以查看預覽…'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {deleteTarget ? (
        <div role="alertdialog" className="admin-card" style={{ borderColor: 'var(--admin-status-danger)', padding: '14px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: 'var(--admin-status-danger)', fontWeight: 600 }}>確定刪除「{deleteTarget.name}」？此操作無法復原。</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="ad-btn" onClick={() => setDeleteTarget(null)}>取消</button>
            <button type="button" className="ad-btn" style={{ background: 'var(--admin-status-danger)', borderColor: 'var(--admin-status-danger)', color: '#fff' }} onClick={handleDelete} disabled={saving}>
              {saving ? '刪除中…' : '刪除'}
            </button>
          </div>
        </div>
      ) : null}

      <section className="admin-card">
        {loading ? (
          <p className="ad-empty">載入範本中…</p>
        ) : templates.length === 0 ? (
          <p className="ad-empty">尚未有範本，請建立第一個通知範本</p>
        ) : (
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr><th>名稱</th><th>渠道</th><th>變數</th><th>啟用</th><th>更新時間</th><th>操作</th></tr>
              </thead>
              <tbody>
                {templates.map((tpl) => {
                  const ch = CHANNELS[tpl.channel] ?? CHANNELS.in_app
                  return (
                    <tr key={tpl.id}>
                      <td data-label="名稱" style={{ fontWeight: 600, minWidth: 120 }}>{tpl.name}</td>
                      <td data-label="渠道"><span className="ad-chip" data-tone={ch.tone}>{ch.label}</span></td>
                      <td data-label="變數">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {tpl.variables.length > 0
                            ? tpl.variables.map((v) => <span key={v} className="ad-chip ad-mono">{'{{' + v + '}}'}</span>)
                            : <span className="ad-muted">—</span>}
                        </div>
                      </td>
                      <td data-label="啟用">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={tpl.isActive}
                          aria-label={`${tpl.name} 啟用`}
                          className="tm-switch"
                          data-on={tpl.isActive}
                          onClick={() => handleToggleActive(tpl)}
                        >
                          <span className="tm-knob" />
                        </button>
                      </td>
                      <td data-label="更新" className="ad-muted" style={{ whiteSpace: 'nowrap' }}>
                        {new Date(tpl.updatedAt ?? tpl.createdAt).toLocaleDateString('zh-HK')}
                      </td>
                      <td data-label="操作">
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" className="ad-btn" onClick={() => handleEdit(tpl)}>編輯</button>
                          <button type="button" className="ad-btn" style={{ color: 'var(--admin-status-danger)' }} onClick={() => setDeleteTarget(tpl)}>刪除</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
