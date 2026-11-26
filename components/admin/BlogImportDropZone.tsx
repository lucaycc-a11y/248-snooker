'use client'

import { useRef, useState } from 'react'
import { UploadCloud, CheckCircle2, Info, AlertTriangle, Undo2, Redo2 } from 'lucide-react'
import { adminTokens as tokens } from '@/lib/admin/admin-tokens'
import { importTextFile, type ImportFixId, type ImportResult } from '@/lib/blog/htmlImport'

const MAX_TEXT_BYTES = 600_000
const TEXT_RE = /\.(html?|md|markdown|txt)$/i
const IMAGE_RE = /^image\/(png|jpeg|webp)$/

type Props = {
  /** True when the post already has content, so the first import asks before overwriting. */
  hasContent: boolean
  onImport: (result: ImportResult) => void
  onImages: (files: File[]) => Promise<void>
}

/**
 * Drop an .html / .md file (or images) anywhere in the zone. HTML and Markdown are cleaned and
 * SEO-optimised by lib/blog/htmlImport; the report lists every change and lets the editor undo
 * each optional one before publishing.
 */
export default function BlogImportDropZone({ hasContent, onImport, onImages }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<{ name: string; text: string } | null>(null)
  const [disabled, setDisabled] = useState<ImportFixId[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)

  async function handleFiles(list: FileList | File[]) {
    setError(null)
    const files = Array.from(list)
    const textFile = files.find((f) => TEXT_RE.test(f.name))
    const images = files.filter((f) => IMAGE_RE.test(f.type))
    if (!textFile && images.length === 0) {
      setError('只支援 .html、.md 文章檔，或 PNG／JPG／WebP 圖片')
      return
    }
    setBusy(true)
    try {
      if (textFile) {
        if (textFile.size > MAX_TEXT_BYTES) {
          setError('檔案太大（上限 600KB）')
          return
        }
        if (hasContent && !window.confirm('匯入會覆蓋目前的標題、摘要、SEO 欄位和內容，確定？')) return
        const text = await textFile.text()
        const res = importTextFile(textFile.name, text)
        setSource({ name: textFile.name, text })
        setDisabled([])
        setResult(res)
        onImport(res)
      }
      if (images.length > 0) await onImages(images)
    } finally {
      setBusy(false)
    }
  }

  function toggle(id: ImportFixId) {
    if (!source) return
    const next = disabled.includes(id) ? disabled.filter((d) => d !== id) : [...disabled, id]
    const res = importTextFile(source.name, source.text, { disabled: next })
    setDisabled(next)
    setResult(res)
    onImport(res)
  }

  const border = over ? tokens.colors.brand : tokens.colors.border

  return (
    <div style={{ marginBottom: tokens.spacing.md }}>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          void handleFiles(e.dataTransfer.files)
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 18px',
          borderRadius: tokens.radius.input,
          border: `1.5px dashed ${border}`,
          background: over ? tokens.colors.brandDim : 'rgba(255,255,255,0.03)',
          transition: 'background .15s, border-color .15s',
        }}
      >
        <UploadCloud size={26} aria-hidden style={{ color: tokens.colors.brand, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.text }}>{busy ? '處理中…' : '把 .html／.md 文章或圖片拖到這裡'}</div>
          <div style={{ fontSize: 12, color: tokens.colors.textMuted, marginTop: 2 }}>
            自動清理不安全標記並優化 SEO（標題、描述、H1、圖片 alt、站內連結、FAQ、行動呼籲），完成後列出改動，可逐項還原。
          </div>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{ minHeight: 36, padding: '0 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: `1px solid ${tokens.colors.border}`, background: 'transparent', color: tokens.colors.text, cursor: 'pointer' }}
        >
          選擇檔案
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".html,.htm,.md,.markdown,.txt,image/png,image/jpeg,image/webp"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files
            if (f && f.length > 0) void handleFiles(f)
            e.target.value = ''
          }}
        />
      </div>

      {error && <div style={{ marginTop: 8, fontSize: 13, color: tokens.colors.danger }}>{error}</div>}

      {result && (
        <div style={{ marginTop: 10, padding: 12, borderRadius: tokens.radius.input, border: `1px solid ${tokens.colors.border}`, background: 'rgba(255,255,255,0.03)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: tokens.colors.text, marginBottom: 8 }}>
            匯入報告 · {source?.name}
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {result.report.map((item, i) => {
              const Icon = item.level === 'fixed' ? CheckCircle2 : item.level === 'warn' ? AlertTriangle : Info
              const color = item.level === 'fixed' ? tokens.colors.brand : item.level === 'warn' ? '#ffb340' : tokens.colors.textMuted
              return (
                <li key={`${item.id}-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: tokens.colors.text }}>
                  <Icon size={15} aria-hidden style={{ color, marginTop: 2, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{item.text}</span>
                  {item.revertable && item.id !== 'strip' && (
                    <button
                      type="button"
                      onClick={() => toggle(item.id as ImportFixId)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, background: 'transparent', border: 'none', color: tokens.colors.textMuted, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      <Undo2 size={12} aria-hidden />還原
                    </button>
                  )}
                </li>
              )
            })}
            {disabled.map((id) => (
              <li key={`off-${id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: tokens.colors.textMuted }}>
                <Info size={15} aria-hidden style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>已還原：{id}</span>
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, background: 'transparent', border: 'none', color: tokens.colors.textMuted, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  <Redo2 size={12} aria-hidden />重新套用
                </button>
              </li>
            ))}
            {result.report.length === 0 && <li style={{ fontSize: 13, color: tokens.colors.textMuted }}>原稿已符合基本 SEO，沒有需要修改的項目。</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
