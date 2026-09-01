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
const CHANNELS: Record<string, { label: string; color: string; bg: string }> = {
  push: { label: 'Push', color: 'var(--admin-brand)', bg: 'var(--admin-brand-dim)' },
  email: { label: 'Email', color: 'var(--admin-warning)', bg: 'var(--admin-warning-dim)' },
  sms: { label: 'SMS', color: 'var(--admin-accent-blue, var(--admin-brand))', bg: 'var(--admin-surface-elevated)' },
  in_app: { label: 'In-App', color: 'var(--admin-text-muted)', bg: 'var(--admin-surface-elevated)' },
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
      setError('Failed to load templates')
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
      setError('Name and body are required')
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
      setError(editingId ? 'Failed to update template' : 'Failed to create template')
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
      setError('Failed to delete template')
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
      setError('Failed to toggle template')
    }
  }, [fetchTemplates])

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 md:px-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--admin-text)' }}
            data-cms-key="admin_notifications_title"
          >
            Notification Templates
          </h1>
          <p className="mt-1 text-xs" style={{ color: 'var(--admin-text-muted)' }}>
            Manage push, email, SMS, and in-app notification templates.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-colors"
          style={{ color: 'var(--admin-brand-text)', background: 'var(--admin-brand)' }}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Template
        </button>
      </header>

      {/* ── Error banner ───────────────────────────────────── */}
      {error && (
        <div
          className="flex items-center justify-between rounded-xl px-4 py-3 text-sm"
          style={{ color: 'var(--admin-danger)', background: 'var(--admin-danger-dim)', border: '1px solid var(--admin-danger)' }}
        >
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-xs opacity-60 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* ── Template Form (slide-down) ─────────────────────── */}
      {showForm && (
        <div
          className="flex flex-col gap-4 rounded-2xl p-5"
          style={{ background: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold" style={{ color: 'var(--admin-text)' }}>
              {editingId ? 'Edit Template' : 'New Template'}
            </h2>
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditingId(null) }}
              className="rounded-lg px-2 py-1 text-xs transition-colors"
              style={{ color: 'var(--admin-text-muted)' }}
            >
              Cancel
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* ── Left: form fields ────────────────────────── */}
            <div className="flex flex-col gap-3">
              {/* Name */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
                  Template Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Booking Confirmation"
                  className="rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--admin-brand)]"
                  style={{ background: 'var(--admin-bg)', color: 'var(--admin-text)', borderColor: 'var(--admin-border)' }}
                />
              </div>

              {/* Channel */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
                  Channel
                </label>
                <div className="flex gap-2">
                  {Object.entries(CHANNELS).map(([key, cfg]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, channel: key }))}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
                      style={{
                        color: form.channel === key ? 'var(--admin-brand-text)' : cfg.color,
                        background: form.channel === key ? 'var(--admin-brand)' : cfg.bg,
                        border: `1px solid ${form.channel === key ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
                      }}
                    >
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject (email only) */}
              {form.channel === 'email' && (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
                    Subject Line
                  </label>
                  <input
                    type="text"
                    value={form.subject}
                    onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                    placeholder="e.g. Your booking at {{venue_name}} is confirmed"
                    className="rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--admin-brand)]"
                    style={{ background: 'var(--admin-bg)', color: 'var(--admin-text)', borderColor: 'var(--admin-border)' }}
                  />
                </div>
              )}

              {/* Body */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
                  Template Body
                </label>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  placeholder="Use {{variable_name}} for dynamic content..."
                  rows={6}
                  className="rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--admin-brand)] resize-y"
                  style={{ background: 'var(--admin-bg)', color: 'var(--admin-text)', borderColor: 'var(--admin-border)' }}
                />
                <p className="text-[10px]" style={{ color: 'var(--admin-text-faint)' }}>
                  Use {'{{variable_name}}'} syntax for dynamic content. Detected: {detectedVariables.length > 0 ? detectedVariables.join(', ') : 'none'}
                </p>
              </div>

              {/* Active toggle */}
              <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--admin-text)' }}>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="h-4 w-4 rounded accent-[var(--admin-brand)]"
                />
                Active
              </label>

              {/* Save button */}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.body.trim()}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
                style={{
                  color: 'var(--admin-brand-text)',
                  background: 'var(--admin-brand)',
                  opacity: saving || !form.name.trim() || !form.body.trim() ? 0.5 : 1,
                }}
              >
                {saving ? <span className="admin-conic-spinner h-4 w-4" /> : editingId ? 'Update Template' : 'Create Template'}
              </button>
            </div>

            {/* ── Right: live preview ───────────────────────── */}
            <div className="flex flex-col gap-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
                Live Preview
              </h3>

              {/* Sample variable values */}
              <div
                className="flex flex-col gap-2 rounded-xl p-3"
                style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)' }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-text-faint)' }}>
                  Sample Values
                </p>
                {detectedVariables.map((v) => (
                  <div key={v} className="flex items-center gap-2">
                    <span className="min-w-[80px] text-[10px] font-mono" style={{ color: 'var(--admin-brand)' }}>
                      {'{{' + v + '}}'}
                    </span>
                    <input
                      type="text"
                      value={variableInputs[v] ?? ''}
                      onChange={(e) => setVariableInputs((prev) => ({ ...prev, [v]: e.target.value }))}
                      className="flex-1 rounded border px-2 py-1 text-[11px] outline-none focus:border-[var(--admin-brand)]"
                      style={{ background: 'var(--admin-surface)', color: 'var(--admin-text)', borderColor: 'var(--admin-border)' }}
                    />
                  </div>
                ))}
                {detectedVariables.length === 0 && (
                  <p className="text-[10px]" style={{ color: 'var(--admin-text-faint)' }}>
                    No variables detected in body.
                  </p>
                )}
              </div>

              {/* Rendered preview */}
              <div
                className="flex flex-col gap-2 rounded-xl p-4"
                style={{ background: 'var(--admin-surface-elevated)', border: '1px solid var(--admin-border)' }}
              >
                {previewSubject && (
                  <p className="text-xs font-bold" style={{ color: 'var(--admin-text)' }}>
                    {previewSubject}
                  </p>
                )}
                <p
                  className="whitespace-pre-wrap text-sm leading-relaxed"
                  style={{ color: 'var(--admin-text)' }}
                >
                  {previewBody || 'Start typing to see preview...'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation dialog ─────────────────────── */}
      {deleteTarget && (
        <div
          className="flex items-center justify-between rounded-xl px-4 py-3"
          style={{ color: 'var(--admin-danger)', background: 'var(--admin-danger-dim)', border: '1px solid var(--admin-danger)' }}
        >
          <span className="text-sm">
            Delete &ldquo;{deleteTarget.name}&rdquo;? This cannot be undone.
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={{ background: 'var(--admin-surface)', color: 'var(--admin-text)' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{ background: 'var(--admin-danger)', color: '#ffffff' }}
            >
              {saving ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      )}

      {/* ── Template List ──────────────────────────────────── */}
      <div
        className="overflow-x-auto rounded-2xl"
        style={{ background: 'var(--admin-surface)', border: '1px solid var(--admin-border)' }}
      >
        <table className="w-full text-left text-xs">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--admin-border)' }}>
              <th className="px-4 py-3 font-semibold" style={{ color: 'var(--admin-text-muted)' }}>Name</th>
              <th className="px-4 py-3 font-semibold" style={{ color: 'var(--admin-text-muted)' }}>Channel</th>
              <th className="px-4 py-3 font-semibold" style={{ color: 'var(--admin-text-muted)' }}>Variables</th>
              <th className="px-4 py-3 font-semibold" style={{ color: 'var(--admin-text-muted)' }}>Status</th>
              <th className="px-4 py-3 font-semibold" style={{ color: 'var(--admin-text-muted)' }}>Updated</th>
              <th className="px-4 py-3 font-semibold" style={{ color: 'var(--admin-text-muted)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center" style={{ color: 'var(--admin-text-muted)' }}>
                  <span className="admin-conic-spinner mx-auto" />
                  <span className="ml-2">Loading templates…</span>
                </td>
              </tr>
            ) : templates.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center" style={{ color: 'var(--admin-text-muted)' }}>
                  No templates yet. Create your first notification template.
                </td>
              </tr>
            ) : (
              templates.map((t) => {
                const ch = CHANNELS[t.channel] ?? CHANNELS.in_app
                return (
                  <tr
                    key={t.id}
                    style={{ borderBottom: '1px solid var(--admin-border)' }}
                    className="transition-colors"
                  >
                    {/* Name */}
                    <td className="max-w-[200px] truncate px-4 py-3 font-medium" style={{ color: 'var(--admin-text)' }}>
                      {t.name}
                    </td>

                    {/* Channel */}
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                        style={{ color: ch.color, background: ch.bg }}
                      >
                        {ch.label}
                      </span>
                    </td>

                    {/* Variables */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {t.variables.length > 0 ? (
                          t.variables.map((v) => (
                            <span
                              key={v}
                              className="inline-flex rounded px-1.5 py-0.5 text-[9px] font-mono"
                              style={{ color: 'var(--admin-brand)', background: 'var(--admin-brand-dim)' }}
                            >
                              {'{{' + v + '}}'}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px]" style={{ color: 'var(--admin-text-faint)' }}>—</span>
                        )}
                      </div>
                    </td>

                    {/* Status toggle */}
                    <td className="whitespace-nowrap px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(t)}
                        className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                        style={{
                          background: t.isActive ? 'var(--admin-brand)' : 'var(--admin-surface-elevated)',
                        }}
                      >
                        <span
                          className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
                          style={{ transform: t.isActive ? 'translateX(17px)' : 'translateX(3px)' }}
                        />
                      </button>
                    </td>

                    {/* Updated */}
                    <td className="whitespace-nowrap px-4 py-3" style={{ color: 'var(--admin-text-muted)' }}>
                      {t.updatedAt
                        ? new Date(t.updatedAt).toLocaleDateString()
                        : new Date(t.createdAt).toLocaleDateString()}
                    </td>

                    {/* Actions */}
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEdit(t)}
                          className="rounded-lg px-2 py-1 text-[10px] font-medium transition-colors"
                          style={{ color: 'var(--admin-brand)', background: 'var(--admin-brand-dim)' }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(t)}
                          className="rounded-lg px-2 py-1 text-[10px] font-medium transition-colors"
                          style={{ color: 'var(--admin-danger)', background: 'var(--admin-danger-dim)' }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Stats footer ───────────────────────────────────── */}
      {!loading && templates.length > 0 && (
        <div className="flex items-center gap-4 text-[10px]" style={{ color: 'var(--admin-text-muted)' }}>
          <span>{templates.length} template{templates.length !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>{templates.filter((t) => t.isActive).length} active</span>
          <span>·</span>
          <span>{templates.filter((t) => !t.isActive).length} inactive</span>
        </div>
      )}
    </main>
  )
}
