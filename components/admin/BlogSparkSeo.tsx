'use client'

import { useMemo, useState } from 'react'
import { Loader2, Sparkles, Wand2, PenLine, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/admin/ui/Button'
import { Input } from '@/components/ui/input'
import { adminTokens as tokens } from '@/lib/admin/admin-tokens'
import { analyseSeo, type SeoInput } from '@/lib/blog/seoCheck'

export type SeoFields = { title: string; slug: string; excerpt: string; seoTitle: string; seoDescription: string; content: string }
type Suggestion = { title?: string; slug?: string; excerpt?: string; seo_title?: string; seo_description?: string; content?: string; notes: string[] }

const LABEL: [keyof Suggestion, keyof SeoFields, string][] = [
  ['title', 'title', '標題'], ['slug', 'slug', '網址代稱'], ['excerpt', 'excerpt', '摘要'],
  ['seo_title', 'seoTitle', 'SEO 標題'], ['seo_description', 'seoDescription', 'SEO 描述'],
]

export default function BlogSparkSeo({ fields, cover, onApply }: { fields: SeoFields; cover: string; onApply: (p: Partial<SeoFields>) => void }) {
  const [keyword, setKeyword] = useState('')
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState<null | 'optimize' | 'generate'>(null)
  const [error, setError] = useState<string | null>(null)
  const [sug, setSug] = useState<Suggestion | null>(null)

  const input: SeoInput = { ...fields, cover, keyword }
  const result = useMemo(() => analyseSeo(input), [input.title, input.slug, input.excerpt, input.seoTitle, input.seoDescription, input.content, input.cover, input.keyword]) // eslint-disable-line react-hooks/exhaustive-deps

  async function run(mode: 'optimize' | 'generate') {
    setBusy(mode); setError(null); setSug(null)
    try {
      const res = await fetch('/api/admin/blog/spark', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, keyword, instruction, title: fields.title, slug: fields.slug, excerpt: fields.excerpt, seo_title: fields.seoTitle, seo_description: fields.seoDescription, content: fields.content, cover }),
      })
      const data: unknown = await res.json().catch(() => null)
      if (!res.ok || typeof data !== 'object' || data === null || !('suggestion' in data)) {
        setError(typeof data === 'object' && data !== null && 'error' in data ? String((data as { error: unknown }).error) : 'Spark 失敗，請再試')
        return
      }
      setSug((data as { suggestion: Suggestion }).suggestion)
    } catch {
      setError('網絡錯誤，請再試')
    } finally {
      setBusy(null)
    }
  }

  const muted = { fontSize: 13, color: tokens.colors.textMuted } as const
  const color = result.score >= 80 ? tokens.colors.brand : result.score >= 55 ? '#f59e0b' : tokens.colors.danger

  return (
    <Card style={{ marginBottom: tokens.spacing.lg }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Sparkles size={16} /><b style={{ fontSize: 15 }}>Spark SEO</b>
        <span style={{ marginLeft: 'auto', fontSize: 22, fontWeight: 700, color }}>{result.score}<small style={{ fontSize: 12, opacity: 0.6 }}> / 100</small></span>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ ...muted, display: 'block', marginBottom: 6 }}>目標關鍵字（例如「旺角 自助桌球」）</label>
        <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} />
      </div>
      <ul style={{ listStyle: 'none', margin: '0 0 12px', padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {result.issues.map((x, i) => (
          <li key={i} style={{ ...muted, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            {x.level === 'ok' ? <CheckCircle2 size={15} color={tokens.colors.brand} style={{ flex: 'none', marginTop: 2 }} /> : x.level === 'warn' ? <AlertTriangle size={15} color="#f59e0b" style={{ flex: 'none', marginTop: 2 }} /> : <XCircle size={15} color={tokens.colors.danger} style={{ flex: 'none', marginTop: 2 }} />}
            <span>{x.text}</span>
          </li>
        ))}
      </ul>
      <label style={{ ...muted, display: 'block', marginBottom: 6 }}>額外要求（可留空）</label>
      <textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={2} maxLength={1500} placeholder="例如：針對第一次嚟玩嘅新手，語氣輕鬆啲"
        style={{ width: '100%', padding: '8px 10px', borderRadius: tokens.radius.input, border: `1px solid ${tokens.colors.border}`, background: 'rgba(255,255,255,0.06)', color: tokens.colors.text, font: 'inherit', fontSize: 14, marginBottom: 10 }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="primary" onClick={() => void run('optimize')} disabled={busy !== null}>
          {busy === 'optimize' ? <Loader2 size={15} className="sp-spin" style={{ marginRight: 6 }} /> : <Wand2 size={15} style={{ marginRight: 6 }} />}優化現有文章
        </Button>
        <Button variant="secondary" onClick={() => void run('generate')} disabled={busy !== null}>
          {busy === 'generate' ? <Loader2 size={15} className="sp-spin" style={{ marginRight: 6 }} /> : <PenLine size={15} style={{ marginRight: 6 }} />}按關鍵字寫新文章
        </Button>
      </div>
      {error && <p style={{ color: tokens.colors.danger, fontSize: 13, margin: '10px 0 0' }} role="alert">{error}</p>}

      {sug && (
        <div style={{ marginTop: 14, borderTop: `1px solid ${tokens.colors.border}`, paddingTop: 12 }}>
          <b style={{ fontSize: 14 }}>Spark 建議（未套用，請逐項確認）</b>
          {sug.notes.length > 0 && <ul style={{ ...muted, margin: '8px 0', paddingLeft: 18 }}>{sug.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
          {LABEL.map(([k, f, name]) => {
            const next = sug[k]
            if (typeof next !== 'string' || next === '' || next === fields[f]) return null
            return (
              <div key={k} style={{ margin: '10px 0', fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <span style={muted}>{name}</span>
                  <Button variant="secondary" onClick={() => onApply({ [f]: next })}>套用</Button>
                </div>
                {fields[f] && <div style={{ textDecoration: 'line-through', opacity: 0.5, wordBreak: 'break-word' }}>{fields[f]}</div>}
                <div style={{ color: tokens.colors.brand, wordBreak: 'break-word' }}>{next}</div>
              </div>
            )
          })}
          {typeof sug.content === 'string' && sug.content !== '' && (
            <div style={{ margin: '10px 0', fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={muted}>內文（{sug.content.length} 字元，會切換去 HTML 模式，可用預覽查看）</span>
                <Button variant="secondary" onClick={() => onApply({ content: sug.content })}>套用內文</Button>
              </div>
            </div>
          )}
          <Button variant="primary" onClick={() => onApply({
            ...(sug.title ? { title: sug.title } : {}), ...(sug.slug ? { slug: sug.slug } : {}), ...(sug.excerpt ? { excerpt: sug.excerpt } : {}),
            ...(sug.seo_title ? { seoTitle: sug.seo_title } : {}), ...(sug.seo_description ? { seoDescription: sug.seo_description } : {}),
            ...(sug.content ? { content: sug.content } : {}),
          })}>全部套用</Button>
          <p style={{ ...muted, margin: '8px 0 0' }}>套用後仍要撳「儲存草稿」先會保存；唔滿意可以重新整理頁面還原。</p>
        </div>
      )}
    </Card>
  )
}
