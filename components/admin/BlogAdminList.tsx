'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ExternalLink, FileText, GripVertical, Plus, Search, Sparkles, Trash2 } from 'lucide-react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/admin/ui/Button'
import { adminTokens as tokens } from '@/lib/admin/admin-tokens'

export type BlogListRow = PostRow

type PostRow = {
  id: string
  slug: string
  locale: string
  title: string
  category: string | null
  cover_image_url: string | null
  published_at: string | null
  ai_generated: boolean | null
  created_at: string | null
  updated_at?: string | null
  views?: number | null
  seo_description?: string | null
}

type Status = 'published' | 'scheduled' | 'draft'
type StatusFilter = 'all' | Status

const GT = "'Good Times', 'JetBrains Mono', monospace"
const STATUS_LABEL: Record<Status, string> = { published: '已發佈', scheduled: '已排程', draft: '草稿' }
const STATUS_COLOR: Record<Status, string> = { published: tokens.colors.brand, scheduled: '#ffb340', draft: tokens.colors.textMuted }

function statusOf(p: PostRow, now: number): Status {
  if (!p.published_at) return 'draft'
  return new Date(p.published_at).getTime() > now ? 'scheduled' : 'published'
}

function publicUrl(p: PostRow): string {
  return `${p.locale === 'zh-HK' ? '' : `/${p.locale}`}/blog/${p.slug}`
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('zh-HK', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function Row({ post, status, sortable, deleting, onDelete }: { post: PostRow; status: Status; sortable: boolean; deleting: boolean; onDelete: (p: PostRow) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: post.id, disabled: !sortable })
  const seoOk = Boolean(post.seo_description && post.seo_description.trim())
  const iconBtn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 10, border: 'none', background: 'transparent', color: tokens.colors.textMuted, cursor: 'pointer', flexShrink: 0 } as const
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, marginBottom: tokens.spacing.sm }}>
      <Card style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.md }}>
        {sortable && (
          <button type="button" aria-label="拖動排序" {...attributes} {...listeners} style={{ ...iconBtn, width: 28, cursor: 'grab', touchAction: 'none' }}>
            <GripVertical size={16} aria-hidden />
          </button>
        )}
        <Link href={`/admin/blog/${post.id}`} style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0, textDecoration: 'none' }}>
          <div style={{ width: 72, height: 48, borderRadius: 10, flexShrink: 0, overflow: 'hidden', background: tokens.colors.surfaceElevated, border: `1px solid ${tokens.colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {post.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.cover_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <FileText size={18} aria-hidden style={{ color: tokens.colors.textFaint }} />
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: tokens.colors.text, fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4, fontSize: 12, color: tokens.colors.textMuted }}>
              <span style={{ color: STATUS_COLOR[status], fontWeight: 600 }}>{STATUS_LABEL[status]}</span>
              <span style={{ fontFamily: GT, fontSize: 10, letterSpacing: '0.06em' }}>{post.locale}</span>
              <span>{post.category ?? '未分類'}</span>
              <span>{status === 'scheduled' ? `排程 ${fmt(post.published_at)}` : `更新 ${fmt(post.updated_at ?? post.created_at)}`}</span>
              {post.ai_generated && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Sparkles size={11} aria-hidden />AI</span>}
              {!seoOk && <span style={{ color: '#ffb340' }}>缺 SEO 描述</span>}
            </div>
          </div>
        </Link>
        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 48 }}>
          <div style={{ fontFamily: GT, fontSize: 15, color: tokens.colors.text }}>{post.views ?? 0}</div>
          <div style={{ fontSize: 11, color: tokens.colors.textFaint }}>瀏覽</div>
        </div>
        {status === 'published' && (
          <a href={publicUrl(post)} target="_blank" rel="noopener noreferrer" aria-label="在前台查看" style={iconBtn}><ExternalLink size={16} aria-hidden /></a>
        )}
        <button type="button" aria-label="刪除文章" onClick={() => onDelete(post)} disabled={deleting} style={{ ...iconBtn, color: tokens.colors.danger, opacity: deleting ? 0.5 : 1, cursor: deleting ? 'default' : 'pointer' }}>
          <Trash2 size={16} aria-hidden />
        </button>
      </Card>
    </div>
  )
}

export default function BlogAdminList({ initialPosts }: { initialPosts: PostRow[] }) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [posts, setPosts] = useState(initialPosts)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [orderError, setOrderError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [localeFilter, setLocaleFilter] = useState('all')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const now = Date.now()

  const counts = useMemo(() => {
    const c = { all: posts.length, published: 0, scheduled: 0, draft: 0 }
    for (const p of posts) c[statusOf(p, now)] += 1
    return c
  }, [posts, now])
  const locales = useMemo(() => [...new Set(posts.map((p) => p.locale))].sort(), [posts])

  const q = query.trim().toLowerCase()
  const visible = posts.filter((p) => (statusFilter === 'all' || statusOf(p, now) === statusFilter) && (localeFilter === 'all' || p.locale === localeFilter) && (!q || `${p.title} ${p.slug} ${p.category ?? ''}`.toLowerCase().includes(q)))
  const filtering = statusFilter !== 'all' || localeFilter !== 'all' || q !== ''

  async function createDraft() {
    setCreating(true)
    try {
      const res = await fetch('/api/admin/blog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: '未命名文章', locale: 'zh-HK' }) })
      const json: unknown = await res.json().catch(() => null)
      const id = typeof json === 'object' && json !== null && 'id' in json ? (json as { id: unknown }).id : null
      if (res.ok && typeof id === 'string') router.push(`/admin/blog/${id}`)
    } finally {
      setCreating(false)
    }
  }

  async function deletePost(post: PostRow) {
    if (!window.confirm(`刪除「${post.title}」？此動作無法還原。`)) return
    setDeletingId(post.id)
    try {
      const res = await fetch(`/api/admin/blog/${post.id}`, { method: 'DELETE' })
      if (res.ok) setPosts((prev) => prev.filter((p) => p.id !== post.id))
    } finally {
      setDeletingId(null)
    }
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = posts.findIndex((p) => p.id === active.id)
    const to = posts.findIndex((p) => p.id === over.id)
    if (from < 0 || to < 0) return
    const previous = posts
    const next = arrayMove(posts, from, to)
    setPosts(next)
    setOrderError(null)
    const res = await fetch('/api/admin/blog/reorder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: next.map((p) => p.id) }) }).catch(() => null)
    if (!res || !res.ok) {
      setPosts(previous)
      setOrderError('排序儲存失敗，已還原')
    }
  }

  const tab = (id: StatusFilter, label: string) => {
    const active = statusFilter === id
    return (
      <button key={id} type="button" aria-pressed={active} onClick={() => setStatusFilter(id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 36, padding: '0 14px', borderRadius: tokens.radius.pill, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1px solid ${active ? tokens.colors.brand : tokens.colors.border}`, background: active ? tokens.colors.brandDim : 'transparent', color: active ? tokens.colors.text : tokens.colors.textMuted }}>
        {label}
        <span style={{ fontFamily: GT, fontSize: 11 }}>{counts[id]}</span>
      </button>
    )
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: tokens.spacing.md, marginBottom: tokens.spacing.lg }}>
        {([['文章總數', counts.all], ['已發佈', counts.published], ['已排程', counts.scheduled], ['草稿', counts.draft]] as const).map(([label, n]) => (
          <Card key={label}>
            <div style={{ fontFamily: GT, fontSize: 28, color: tokens.colors.text, lineHeight: 1 }}>{n}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: tokens.colors.textMuted }}>{label}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'flex', gap: tokens.spacing.md, flexWrap: 'wrap', alignItems: 'center', marginBottom: tokens.spacing.md }}>
        <label style={{ flex: '1 1 240px', display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '0 14px', borderRadius: tokens.radius.input, border: `1px solid ${tokens.colors.border}`, background: 'rgba(255,255,255,0.06)', color: tokens.colors.text }}>
          <Search size={15} aria-hidden style={{ color: tokens.colors.textMuted }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜尋標題、網址代稱、分類" aria-label="搜尋文章" style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: 'inherit', fontSize: 14 }} />
        </label>
        {locales.length > 1 && (
          <select value={localeFilter} onChange={(e) => setLocaleFilter(e.target.value)} aria-label="語言" style={{ minHeight: 40, padding: '0 12px', borderRadius: tokens.radius.input, border: `1px solid ${tokens.colors.border}`, background: 'rgba(255,255,255,0.06)', color: tokens.colors.text, fontSize: 13 }}>
            <option value="all">全部語言</option>
            {locales.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
        <Button variant="primary" onClick={createDraft} disabled={creating}>
          <Plus size={16} style={{ marginRight: 6 }} />
          {creating ? '建立中…' : '新增文章'}
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: tokens.spacing.md }}>
        {tab('all', '全部')}
        {tab('published', '已發佈')}
        {tab('scheduled', '已排程')}
        {tab('draft', '草稿')}
      </div>

      {orderError && <div style={{ color: tokens.colors.danger, fontSize: 13, marginBottom: 8 }}>{orderError}</div>}
      <p style={{ margin: '0 0 10px', fontSize: 12, color: tokens.colors.textMuted }}>
        {filtering ? '篩選中不能排序；清除篩選後可拖動調整前台順序。' : '拖動左邊把手調整文章順序；前台博客「精選排序」依此排列。'}
      </p>

      {posts.length === 0 && (
        <Card><div style={{ color: tokens.colors.textMuted, fontSize: 14 }}>尚未有文章。按「新增文章」開始，或在編輯器拖入 .html／.md 檔案匯入。</div></Card>
      )}
      {posts.length > 0 && visible.length === 0 && (
        <Card><div style={{ color: tokens.colors.textMuted, fontSize: 14 }}>沒有符合條件的文章。</div></Card>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={visible.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          {visible.map((post) => (
            <Row key={post.id} post={post} status={statusOf(post, now)} sortable={!filtering} deleting={deletingId === post.id} onDelete={deletePost} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  )
}
