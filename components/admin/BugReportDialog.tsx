'use client'

/**
 * BugReportDialog — 回報問題. Admin only (mounted by AdminShell).
 * Sends what happened, how bad it is and an optional screenshot; the server adds the
 * account, page, device and the latest site errors, stores the report and emails the owner.
 */

import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Send, X } from 'lucide-react'
import { useAdminToast } from './ToastProvider'

type Severity = 'urgent' | 'annoying' | 'idea'

const OPTIONS: { id: Severity; label: string; hint: string }[] = [
  { id: 'urgent', label: '影響營業', hint: '客人或員工無法正常使用' },
  { id: 'annoying', label: '不便', hint: '可以用，但很麻煩' },
  { id: 'idea', label: '建議', hint: '想要新功能或改善' },
]

const MAX_EDGE = 1400

function readAsImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('無法處理圖片'))
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('無法讀取圖片'))
    }
    img.src = url
  })
}

export default function BugReportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useAdminToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<Severity>('annoying')
  const [shot, setShot] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    titleRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  if (!open) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/bug-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          severity,
          screenshot: shot,
          pageUrl: window.location.href,
          viewport: `${window.innerWidth}×${window.innerHeight}`,
          userAgent: navigator.userAgent,
        }),
      })
      const body: unknown = await res.json().catch(() => null)
      const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
      if (!res.ok) {
        setError(typeof record.error === 'string' ? record.error : '提交失敗，請稍後再試')
        return
      }
      toast.show(
        record.emailSent === true
          ? { message: '已提交，並已電郵通知', tone: 'success' }
          : { message: '已儲存，但電郵未能發送', detail: '可在「問題回報」頁查看', tone: 'error' },
      )
      setTitle('')
      setDescription('')
      setShot(null)
      setSeverity('annoying')
      onClose()
    } catch {
      setError('網絡錯誤，請稍後再試')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="bug-scrim"
      role="presentation"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <form className="bug-panel" role="dialog" aria-modal="true" aria-label="回報問題" onSubmit={submit}>
        <div className="bug-head">
          <h2>回報問題</h2>
          <button type="button" className="ah-ic-btn" onClick={onClose} aria-label="關閉" disabled={busy}>
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="admin-field">
          <label htmlFor="bug-title">一句話說明</label>
          <input id="bug-title" ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required placeholder="例：預約列表按取消沒有反應" />
        </div>

        <div className="admin-field">
          <label htmlFor="bug-desc">發生了什麼事</label>
          <textarea id="bug-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} required rows={5} placeholder="你做了什麼、預期會怎樣、實際看到什麼" />
        </div>

        <fieldset className="bug-sev">
          <legend>嚴重程度</legend>
          {OPTIONS.map((o) => (
            <label key={o.id} className={severity === o.id ? 'on' : ''}>
              <input type="radio" name="severity" value={o.id} checked={severity === o.id} onChange={() => setSeverity(o.id)} />
              <b>{o.label}</b>
              <small>{o.hint}</small>
            </label>
          ))}
        </fieldset>

        <div className="bug-shot">
          <label className="admin-pill-btn sm">
            <ImagePlus size={16} aria-hidden />
            {shot ? '更換截圖' : '附上截圖（可選）'}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                try {
                  setShot(await readAsImage(file))
                } catch (err) {
                  setError(err instanceof Error ? err.message : '無法讀取圖片')
                }
              }}
            />
          </label>
          {shot ? (
            <span className="bug-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shot} alt="已選擇的截圖" />
              <button type="button" onClick={() => setShot(null)} aria-label="移除截圖">
                <X size={14} aria-hidden />
              </button>
            </span>
          ) : null}
        </div>

        <p className="bug-note">會自動附上：目前頁面、你的帳戶、瀏覽器與螢幕尺寸，以及最近 10 條網站錯誤。</p>
        {error ? <p className="bug-error" role="alert">{error}</p> : null}

        <div className="bug-actions">
          <button type="button" className="admin-pill-btn" onClick={onClose} disabled={busy}>取消</button>
          <button type="submit" className="admin-pill-btn primary" disabled={busy || title.trim() === '' || description.trim() === ''}>
            <Send size={16} aria-hidden />
            {busy ? '提交中…' : '提交'}
          </button>
        </div>
      </form>
    </div>
  )
}
