'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TiptapImage from '@tiptap/extension-image'
import TiptapLink from '@tiptap/extension-link'
import { Bold, Italic, List, ListOrdered, Quote, Heading2, LinkIcon, ImagePlus, Sparkles, Languages, Check, Code2, Eye, CalendarClock, LayoutList } from 'lucide-react'
import BlogPreviewDrawer from '@/components/admin/BlogPreviewDrawer'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/admin/ui/Button'
import { Input } from '@/components/ui/input'
import BlogSparkSeo from '@/components/admin/BlogSparkSeo'
import BlogImportDropZone from '@/components/admin/BlogImportDropZone'
import BlogBlocksEditor from '@/components/admin/BlogBlocksEditor'
import type { ImportResult } from '@/lib/blog/htmlImport'
import { adminTokens as tokens } from '@/lib/admin/admin-tokens'

type BlogPost = {
  id: string
  slug: string
  locale: string
  title: string
  excerpt: string | null
  content: string | null
  category: string | null
  seo_title: string | null
  seo_description: string | null
  cover_image_url: string | null
  og_image_url: string | null
  author: string | null
  published_at: string | null
  translation_group_id?: string | null // Optional until column exists
}

type SiblingPost = { id: string; locale: string }

const LOCALES = ['zh-HK', 'zh-CN', 'en']

// Markup the visual (Tiptap) editor would silently strip — such posts open in HTML mode.
const NEEDS_HTML = /<(table|div|section|aside|details|span)\b|data-s8/i

const SNIPPETS: { label: string; html: string }[] = [
  { label: '預約 CTA', html: '\n<div data-s8="cta-booking"></div>\n' },
  { label: '會員 CTA', html: '\n<div data-s8="cta-member"></div>\n' },
  { label: '自訂 CTA', html: '\n<div data-s8="cta" data-title="標題" data-text="說明文字" data-label="按鈕文字" data-href="/book"></div>\n' },
  { label: '表格', html: '\n<table>\n<thead><tr><th>項目</th><th>內容</th></tr></thead>\n<tbody><tr><td>—</td><td>—</td></tr></tbody>\n</table>\n' },
  { label: 'FAQ', html: '\n<details><summary>問題？</summary><p>答案。</p></details>\n' },
  { label: '提示框', html: '\n<div class="s8-note"><p>重點提示。</p></div>\n' },
]

function postStatus(publishedAt: string | null): 'draft' | 'scheduled' | 'published' {
  if (!publishedAt) return 'draft'
  return new Date(publishedAt).getTime() > Date.now() ? 'scheduled' : 'published'
}

function toLocalInput(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date(Date.now() + 3600_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function ToolbarButton({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        borderRadius: tokens.radius.button,
        border: 'none',
        background: active ? tokens.colors.brandDim : 'transparent',
        color: active ? tokens.colors.brand : tokens.colors.textMuted,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

export default function BlogEditorForm({ post, siblings }: { post: BlogPost; siblings: SiblingPost[] }) {
  const router = useRouter()
  const [title, setTitle] = useState(post.title)
  const [slug, setSlug] = useState(post.slug)
  const [excerpt, setExcerpt] = useState(post.excerpt ?? '')
  const [category, setCategory] = useState(post.category ?? '')
  const [seoTitle, setSeoTitle] = useState(post.seo_title ?? '')
  const [seoDescription, setSeoDescription] = useState(post.seo_description ?? '')
  const [coverImageUrl, setCoverImageUrl] = useState(post.cover_image_url ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [translating, setTranslating] = useState<string | null>(null)
  const [translateError, setTranslateError] = useState<string | null>(null)

  const [mode, setMode] = useState<'visual' | 'html'>(NEEDS_HTML.test(post.content ?? '') ? 'html' : 'visual')
  const [html, setHtml] = useState(post.content ?? '')
  const [visualHtml, setVisualHtml] = useState(post.content ?? '')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewVersion, setPreviewVersion] = useState(0)
  const [scheduleAt, setScheduleAt] = useState(toLocalInput(post.published_at))
  const [scheduleMsg, setScheduleMsg] = useState<string | null>(null)
  const htmlRef = useRef<HTMLTextAreaElement>(null)
  const [blocksOpen, setBlocksOpen] = useState(false)
  const [htmlVersion, setHtmlVersion] = useState(0)
  const status = postStatus(post.published_at)

  const editor = useEditor({
    extensions: [StarterKit, TiptapImage, TiptapLink.configure({ openOnClick: false })],
    content: post.content ?? '',
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => setVisualHtml(e.getHTML()),
  })

  const currentHtml = mode === 'html' ? html : visualHtml

  function switchMode(next: 'visual' | 'html') {
    if (next === mode) return
    if (next === 'html') {
      setHtml(visualHtml)
    } else {
      if (!window.confirm('返回視覺編輯會移除表格、CTA 組件等進階標記，確定？')) return
      editor?.commands.setContent(html)
      setVisualHtml(editor?.getHTML() ?? html)
    }
    setMode(next)
  }

  function insertSnippet(snippet: string) {
    const el = htmlRef.current
    const at = el ? el.selectionStart : html.length
    setHtml((h) => h.slice(0, at) + snippet + h.slice(at))
    setHtmlVersion((v) => v + 1)
  }

  // Applies a dropped .html/.md import (also re-applied when a single fix is undone).
  function applyImport(r: ImportResult) {
    if (r.title) setTitle(r.title)
    if (r.slug) setSlug(r.slug)
    setExcerpt(r.excerpt)
    setSeoTitle(r.seoTitle)
    setSeoDescription(r.seoDescription)
    setHtml(r.content)
    setVisualHtml(r.content)
    setMode('html')
    setHtmlVersion((v) => v + 1)
  }

  // Dropped images are uploaded to the post's folder and appended as <img> with an alt to refine.
  async function addImages(files: File[]) {
    setImageError(null)
    const tags: string[] = []
    for (const file of files) {
      const form = new FormData()
      form.append('file', file)
      form.append('post_id', post.id)
      const res = await fetch('/api/admin/blog/upload-image', { method: 'POST', body: form })
      const json: unknown = await res.json().catch(() => null)
      const url = typeof json === 'object' && json !== null && 'url' in json && typeof (json as { url: unknown }).url === 'string' ? (json as { url: string }).url : null
      if (!res.ok || !url) {
        setImageError(`「${file.name}」上傳失敗（PNG／JPG／WebP，最大 8MB）`)
        continue
      }
      if (!coverImageUrl && tags.length === 0) setCoverImageUrl(url)
      const alt = file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').replace(/"/g, '')
      tags.push(`<figure><img src="${url}" alt="${alt || title}"></figure>`)
    }
    if (tags.length === 0) return
    const base = currentHtml
    const next = `${base}${base.trim() ? '\n' : ''}${tags.join('\n')}`
    setHtml(next)
    setVisualHtml(next)
    setMode('html')
    setHtmlVersion((v) => v + 1)
  }

  async function schedule() {
    setScheduleMsg(null)
    const when = new Date(scheduleAt)
    if (Number.isNaN(when.getTime())) { setScheduleMsg('時間格式不正確'); return }
    setSaving(true)
    try {
      await save()
      const ok = await patch({ publish_at: when.toISOString() })
      if (ok) window.location.reload()
      else setScheduleMsg('排程失敗，請再試')
    } finally {
      setSaving(false)
    }
  }

  const patch = useCallback(
    async (fields: Record<string, unknown>) => {
      const res = await fetch(`/api/admin/blog/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      return res.ok
    },
    [post.id]
  )

  async function save(): Promise<boolean> {
    setSaving(true)
    try {
      const ok = await patch({
        title,
        slug,
        excerpt: excerpt || null,
        content: currentHtml,
        category: category || null,
        seo_title: seoTitle || null,
        seo_description: seoDescription || null,
        cover_image_url: coverImageUrl || null,
      })
      if (ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
      return ok
    } finally {
      setSaving(false)
    }
  }

  const previewPath = `${post.locale === 'zh-HK' ? '' : `/${post.locale}`}/blog/preview/${post.id}`

  // Save the draft first so the iframe (which reads the saved row) shows exactly what is on screen.
  async function openPreview() {
    setPreviewOpen(true)
    if (await save()) setPreviewVersion((v) => v + 1)
  }

  async function refreshPreview() {
    if (await save()) setPreviewVersion((v) => v + 1)
  }

  async function togglePublish() {
    setSaving(true)
    try {
      await save()
      await patch({ publish: !post.published_at })
      window.location.reload()
    } finally {
      setSaving(false)
    }
  }

  async function uploadCoverImage(file: File) {
    setUploading(true)
    setImageError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('post_id', post.id)
      const res = await fetch('/api/admin/blog/upload-image', { method: 'POST', body: form })
      const json = await res.json()
      if (res.ok && json.url) {
        setCoverImageUrl(json.url)
      } else {
        setImageError(json.error === 'file_too_large' ? 'Image too large (max 8MB)' : 'Upload failed')
      }
    } finally {
      setUploading(false)
    }
  }

  async function generateCoverImage() {
    setGeneratingImage(true)
    setImageError(null)
    try {
      const res = await fetch('/api/admin/blog/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id, prompt: title || excerpt || 'Space8 snooker club' }),
      })
      const json = await res.json()
      if (res.ok && json.url) {
        setCoverImageUrl(json.url)
      } else {
        setImageError(
          json.error === 'vectorengine_not_configured'
            ? 'AI image generation is not set up yet.'
            : 'Image generation failed — try again.'
        )
      }
    } finally {
      setGeneratingImage(false)
    }
  }

  async function translateTo(targetLocale: string) {
    setTranslating(targetLocale)
    setTranslateError(null)
    try {
      const res = await fetch('/api/admin/blog/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id, target_locale: targetLocale }),
      })
      const json = await res.json()
      if (res.ok && json.id) {
        router.push(`/admin/blog/${json.id}`)
      } else {
        setTranslateError(
          json.error === 'translation_exists'
            ? `${targetLocale} translation already exists.`
            : json.error === 'vectorengine_not_configured'
              ? 'AI translate is not set up yet.'
              : 'Translation failed — try again.'
        )
      }
    } finally {
      setTranslating(null)
    }
  }

  function handleLocaleTab(targetLocale: string) {
    if (targetLocale === post.locale) return
    const sibling = siblings.find((s) => s.locale === targetLocale)
    if (sibling) {
      router.push(`/admin/blog/${sibling.id}`)
    } else {
      if (window.confirm(`Create ${targetLocale} translation with AI?`)) {
        translateTo(targetLocale)
      }
    }
  }

  return (
    <>
    <div style={{ position: 'sticky', top: 0, zIndex: 40, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '0 0 20px', padding: '10px 14px', borderRadius: 16, border: `1px solid ${tokens.colors.border}`, background: 'var(--admin-bg-elevated)', backdropFilter: 'blur(18px) saturate(180%)', WebkitBackdropFilter: 'blur(18px) saturate(180%)' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: status === 'published' ? tokens.colors.brand : status === 'scheduled' ? '#ffb340' : tokens.colors.textMuted }}>
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: 'currentColor' }} />
        {status === 'published' ? '已發佈' : status === 'scheduled' ? '已排程' : '草稿'}
      </span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: tokens.colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title || '未命名文章'}</span>
      {saved && <span style={{ fontSize: 12, color: tokens.colors.brand }}>已儲存</span>}
      {status === 'published' && (
        <a href={`${post.locale === 'zh-HK' ? '' : `/${post.locale}`}/blog/${post.slug}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: tokens.colors.brand, textDecoration: 'none' }}>前台 ↗</a>
      )}
      <Button variant="secondary" onClick={openPreview} disabled={saving}><Eye size={15} style={{ marginRight: 6 }} />預覽</Button>
      <Button variant="secondary" onClick={save} disabled={saving}>{saving ? '儲存中…' : '儲存'}</Button>
      <Button variant="primary" onClick={togglePublish} disabled={saving}>{post.published_at ? '取消發佈' : '立即發佈'}</Button>
    </div>
    <BlogPreviewDrawer open={previewOpen} onClose={() => setPreviewOpen(false)} src={previewPath} version={previewVersion} onRefresh={refreshPreview} refreshing={saving} />
    <div className="blog-editor-grid">
      <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: tokens.spacing.lg, flexWrap: 'wrap' }}>
        {LOCALES.map((l) => {
          const isCurrent = l === post.locale
          const hasSibling = siblings.some((s) => s.locale === l)
          const isTranslating = translating === l
          return (
            <button
              key={l}
              onClick={() => handleLocaleTab(l)}
              disabled={isTranslating}
              style={{
                padding: '6px 12px',
                borderRadius: tokens.radius.button,
                border: `1px solid ${isCurrent ? tokens.colors.brand : tokens.colors.border}`,
                background: isCurrent ? tokens.colors.brandDim : 'transparent',
                color: isCurrent ? tokens.colors.text : hasSibling ? tokens.colors.textMuted : 'rgba(255,255,255,0.35)',
                fontSize: 12,
                fontWeight: 600,
                cursor: isTranslating ? 'wait' : isCurrent ? 'default' : 'pointer',
                position: 'relative',
                opacity: isTranslating ? 0.6 : 1,
              }}
            >
              {l}
              {!isCurrent && hasSibling && <Check size={14} aria-hidden style={{ marginLeft: 4, verticalAlign: '-2px' }} />}
              {isTranslating && <Languages size={12} style={{ marginLeft: 4 }} />}
            </button>
          )
        })}
      </div>
      {translateError && (
        <div style={{ marginBottom: tokens.spacing.sm, padding: 12, background: 'rgba(255,69,58,0.1)', border: `1px solid ${tokens.colors.danger}`, borderRadius: tokens.radius.input, color: tokens.colors.danger, fontSize: 13 }}>
          {translateError}
        </div>
      )}

      <Card style={{ marginBottom: tokens.spacing.lg }}>
        <div style={{ marginBottom: tokens.spacing.md }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, letterSpacing: '0.02em', color: tokens.colors.textMuted }}>標題</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div style={{ marginBottom: tokens.spacing.md }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, letterSpacing: '0.02em', color: tokens.colors.textMuted }}>網址代稱</label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
        </div>
        <div style={{ marginBottom: tokens.spacing.md }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, letterSpacing: '0.02em', color: tokens.colors.textMuted }}>分類</label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="教學、場地、活動、文化" />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, letterSpacing: '0.02em', color: tokens.colors.textMuted }}>摘要</label>
          <Input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
        </div>
      </Card>
      <Card style={{ marginBottom: tokens.spacing.lg }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.02em', color: tokens.colors.textMuted }}>Content</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button variant={mode === 'visual' ? 'primary' : 'secondary'} onClick={() => switchMode('visual')}>視覺編輯</Button>
            <Button variant={mode === 'html' ? 'primary' : 'secondary'} onClick={() => switchMode('html')}><Code2 size={15} style={{ marginRight: 6 }} />HTML</Button>
          </div>
        </div>
        <BlogImportDropZone hasContent={currentHtml.trim() !== ''} onImport={applyImport} onImages={addImages} />
        {mode === 'html' && (
          <div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {SNIPPETS.map((sn) => (
                <Button key={sn.label} variant="secondary" onClick={() => insertSnippet(sn.html)}>+ {sn.label}</Button>
              ))}
              <Button variant={blocksOpen ? 'primary' : 'secondary'} onClick={() => { setBlocksOpen((o) => !o); setHtmlVersion((v) => v + 1) }}><LayoutList size={15} style={{ marginRight: 6 }} />區塊排序</Button>
            </div>
            {blocksOpen ? (
              <BlogBlocksEditor key={htmlVersion} html={html} onChange={(h) => { setHtml(h); setVisualHtml(h) }} />
            ) : (
            <textarea
              ref={htmlRef}
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              spellCheck={false}
              aria-label="HTML 原始碼"
              style={{ width: '100%', minHeight: 380, padding: 12, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, lineHeight: 1.55, background: 'rgba(255,255,255,0.06)', border: `1px solid ${tokens.colors.border}`, borderRadius: tokens.radius.input, color: tokens.colors.text, resize: 'vertical' }}
            />
            )}
            <p style={{ margin: '8px 0 0', fontSize: 12, color: tokens.colors.textMuted }}>
              只保留安全標記：script、style、iframe、form、事件屬性會自動移除；h1 會變 h2（頁面標題已係 h1）。CTA 用 data-s8 組件，文字會跟語言。
            </p>
          </div>
        )}
        {mode === 'visual' && editor && (
          <div style={{ display: 'flex', gap: 2, marginBottom: tokens.spacing.sm, borderBottom: `1px solid ${tokens.colors.border}`, paddingBottom: tokens.spacing.sm }}>
            <ToolbarButton title="粗體" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
              <Bold size={16} />
            </ToolbarButton>
            <ToolbarButton title="斜體" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
              <Italic size={16} />
            </ToolbarButton>
            <ToolbarButton title="標題" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
              <Heading2 size={16} />
            </ToolbarButton>
            <ToolbarButton title="項目清單" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
              <List size={16} />
            </ToolbarButton>
            <ToolbarButton title="編號清單" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
              <ListOrdered size={16} />
            </ToolbarButton>
            <ToolbarButton title="引言" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
              <Quote size={16} />
            </ToolbarButton>
            <ToolbarButton
              title="連結"
              active={editor.isActive('link')}
              onClick={() => {
                const url = window.prompt('URL')
                if (url) editor.chain().focus().setLink({ href: url }).run()
              }}
            >
              <LinkIcon size={16} />
            </ToolbarButton>
          </div>
        )}
        <div
          hidden={mode === 'html'}
          style={{
            minHeight: 300,
            padding: 14,
            backgroundColor: 'rgba(255,255,255,0.06)',
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: tokens.radius.input,
            color: tokens.colors.text,
          }}
        >
          <EditorContent editor={editor} />
        </div>
      </Card>
      <BlogSparkSeo
        fields={{ title, slug, excerpt, seoTitle, seoDescription, content: currentHtml }}
        cover={coverImageUrl}
        onApply={(p) => {
          if (p.title !== undefined) setTitle(p.title)
          if (p.slug !== undefined) setSlug(p.slug)
          if (p.excerpt !== undefined) setExcerpt(p.excerpt)
          if (p.seoTitle !== undefined) setSeoTitle(p.seoTitle)
          if (p.seoDescription !== undefined) setSeoDescription(p.seoDescription)
          if (p.content !== undefined) { setHtml(p.content); setMode('html'); setHtmlVersion((v) => v + 1) }
        }}
      />
      </div>
      <aside className="blog-editor-side">
      <Card style={{ marginBottom: tokens.spacing.lg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13, fontWeight: 600, letterSpacing: '0.02em', color: tokens.colors.textMuted }}>
          <CalendarClock size={15} />發佈狀態：
          <b style={{ color: status === 'published' ? tokens.colors.brand : tokens.colors.text }}>
            {status === 'published' ? '已發佈' : status === 'scheduled' ? `已排程 ${new Date(post.published_at ?? '').toLocaleString('zh-HK')}` : '草稿'}
          </b>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} aria-label="排程發佈時間"
            style={{ padding: '8px 10px', borderRadius: tokens.radius.input, border: `1px solid ${tokens.colors.border}`, background: 'rgba(255,255,255,0.06)', color: tokens.colors.text }} />
          <Button variant="secondary" onClick={schedule} disabled={saving}>排程發佈</Button>
          {scheduleMsg && <span style={{ fontSize: 13, color: tokens.colors.danger }}>{scheduleMsg}</span>}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: tokens.colors.textMuted }}>到時間會自動出現喺前台，唔使再撳發佈。</p>
      </Card>
      <Card style={{ marginBottom: tokens.spacing.lg }}>
        <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, letterSpacing: '0.02em', color: tokens.colors.textMuted }}>
          Cover image
        </label>
        {coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImageUrl} alt="部落格文章封面圖片" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: tokens.radius.input, marginBottom: tokens.spacing.sm }} />
        )}
        <div style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap' }}>
          <label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) uploadCoverImage(file)
              }}
            />
            <Button variant="secondary" disabled={uploading}>
              <ImagePlus size={16} style={{ marginRight: 6 }} />
              {uploading ? 'Uploading...' : 'Upload image'}
            </Button>
          </label>
          <Button variant="secondary" disabled={generatingImage} onClick={generateCoverImage}>
            <Sparkles size={16} style={{ marginRight: 6 }} />
            {generatingImage ? 'Generating...' : 'Generate with AI'}
          </Button>
        </div>
        {imageError && <div style={{ color: tokens.colors.danger, fontSize: 13, marginTop: 8 }}>{imageError}</div>}
      </Card>
      <Card style={{ marginBottom: tokens.spacing.lg }}>
        <div style={{ marginBottom: tokens.spacing.md }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, letterSpacing: '0.02em', color: tokens.colors.textMuted }}>SEO 標題</label>
          <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, letterSpacing: '0.02em', color: tokens.colors.textMuted }}>SEO 描述</label>
          <Input value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} />
        </div>
      </Card>
      </aside>
    </div>
    </>
  )
}
