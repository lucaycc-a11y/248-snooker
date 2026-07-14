'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TiptapImage from '@tiptap/extension-image'
import TiptapLink from '@tiptap/extension-link'
import { Bold, Italic, List, ListOrdered, Quote, Heading2, LinkIcon, ImagePlus, Sparkles, Languages } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { tokens } from '@/app/styles/tokens'

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
  translation_group_id: string | null
}

type SiblingPost = { id: string; locale: string }

const LOCALES = ['zh-HK', 'zh-CN', 'en']

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

  const editor = useEditor({
    extensions: [StarterKit, TiptapImage, TiptapLink.configure({ openOnClick: false })],
    content: post.content ?? '',
    immediatelyRender: false,
  })

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

  async function save() {
    setSaving(true)
    try {
      const ok = await patch({
        title,
        slug,
        excerpt: excerpt || null,
        content: editor?.getHTML() ?? '',
        category: category || null,
        seo_title: seoTitle || null,
        seo_description: seoDescription || null,
        cover_image_url: coverImageUrl || null,
      })
      if (ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } finally {
      setSaving(false)
    }
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
    <div>
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
              {!isCurrent && hasSibling && <span style={{ marginLeft: 4 }}>✓</span>}
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
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div style={{ marginBottom: tokens.spacing.md }}>
          <Input label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
        </div>
        <div style={{ marginBottom: tokens.spacing.md }}>
          <Input label="Category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="tutorial, venue, event, culture" />
        </div>
        <div>
          <Input label="Excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
        </div>
      </Card>

      <Card style={{ marginBottom: tokens.spacing.lg }}>
        <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500, color: tokens.colors.textMuted }}>
          Cover image
        </label>
        {coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImageUrl} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: tokens.radius.input, marginBottom: tokens.spacing.sm }} />
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
            <Button variant="secondary" size="sm" leftIcon={<ImagePlus size={16} />} loading={uploading} disabled={uploading}>
              Upload image
            </Button>
          </label>
          <Button variant="secondary" size="sm" leftIcon={<Sparkles size={16} />} loading={generatingImage} disabled={generatingImage} onClick={generateCoverImage}>
            Generate with AI
          </Button>
        </div>
        {imageError && <div style={{ color: tokens.colors.danger, fontSize: 13, marginTop: 8 }}>{imageError}</div>}
      </Card>

      <Card style={{ marginBottom: tokens.spacing.lg }}>
        <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500, color: tokens.colors.textMuted }}>
          Content
        </label>
        {editor && (
          <div style={{ display: 'flex', gap: 2, marginBottom: tokens.spacing.sm, borderBottom: `1px solid ${tokens.colors.border}`, paddingBottom: tokens.spacing.sm }}>
            <ToolbarButton title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
              <Bold size={16} />
            </ToolbarButton>
            <ToolbarButton title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
              <Italic size={16} />
            </ToolbarButton>
            <ToolbarButton title="Heading" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
              <Heading2 size={16} />
            </ToolbarButton>
            <ToolbarButton title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
              <List size={16} />
            </ToolbarButton>
            <ToolbarButton title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
              <ListOrdered size={16} />
            </ToolbarButton>
            <ToolbarButton title="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
              <Quote size={16} />
            </ToolbarButton>
            <ToolbarButton
              title="Link"
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

      <Card style={{ marginBottom: tokens.spacing.lg }}>
        <div style={{ marginBottom: tokens.spacing.md }}>
          <Input label="SEO title" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
        </div>
        <div>
          <Input label="SEO description" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} />
        </div>
      </Card>

      <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.sm }}>
        <Button variant="secondary" size="md" onClick={save} loading={saving}>
          Save draft
        </Button>
        <Button variant="primary" size="md" onClick={togglePublish} disabled={saving}>
          {post.published_at ? 'Unpublish' : 'Publish'}
        </Button>
        {saved && <span style={{ fontSize: 13, color: tokens.colors.brand }}>Saved</span>}
      </div>
    </div>
  )
}
