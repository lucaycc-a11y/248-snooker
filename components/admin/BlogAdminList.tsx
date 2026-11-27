'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/admin/ui/Button'
import { adminTokens as tokens } from '@/lib/admin/admin-tokens'

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
}

function SortableCard({ id, children }: { id: string; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const handle = (
    <button type="button" aria-label="拖動排序" {...attributes} {...listeners} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 32, border: 'none', background: 'transparent', color: tokens.colors.textMuted, cursor: 'grab', touchAction: 'none', flexShrink: 0 }}>
      <GripVertical size={16} aria-hidden />
    </button>
  )
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, marginBottom: tokens.spacing.sm }}>
      {children(handle)}
    </div>
  )
}

export default function BlogAdminList({ initialPosts }: { initialPosts: PostRow[] }) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [posts, setPosts] = useState(initialPosts)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [orderError, setOrderError] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

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

  async function createDraft() {
    setCreating(true)
    try {
      const res = await fetch('/api/admin/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '未命名文章', locale: 'zh-HK' }),
      })
      const json = await res.json()
      if (res.ok && json.id) router.push(`/admin/blog/${json.id}`)
    } finally {
      setCreating(false)
    }
  }

  async function deletePost(post: PostRow) {
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return
    setDeletingId(post.id)
    try {
      const res = await fetch(`/api/admin/blog/${post.id}`, { method: 'DELETE' })
      if (res.ok) setPosts((prev) => prev.filter((p) => p.id !== post.id))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <Button variant="primary" onClick={createDraft} disabled={creating} style={{ marginBottom: tokens.spacing.lg }}>
        <Plus size={16} style={{ marginRight: 6 }} />
        {creating ? 'Creating...' : 'New post'}
      </Button>

      {posts.length === 0 && (
        <Card>
          <div style={{ color: tokens.colors.textMuted, fontSize: 14 }}>尚未有文章。</div>
        </Card>
      )}

      {orderError && <div style={{ color: tokens.colors.danger, fontSize: 13, marginBottom: 8 }}>{orderError}</div>}
      {posts.length > 1 && <p style={{ margin: '0 0 8px', fontSize: 12, color: tokens.colors.textMuted }}>拖動左邊把手調整文章順序；公開博客列表會依此排列。</p>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={posts.map((p) => p.id)} strategy={verticalListSortingStrategy}>
      {posts.map((post) => (
        <SortableCard key={post.id} id={post.id}>{(handle) => (
        <Card style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.md }}>
          {handle}
          <Link href={`/admin/blog/${post.id}`} style={{ textDecoration: 'none', flex: 1, minWidth: 0 }}>
            <div style={{ color: tokens.colors.text, fontSize: 15, fontWeight: 600 }}>{post.title}</div>
            <div style={{ color: tokens.colors.textMuted, fontSize: 12, marginTop: 2 }}>
              {post.locale} · {post.category ?? 'uncategorized'} · {post.published_at ? 'Published' : 'Draft'}
              {post.ai_generated && ' · AI'}
            </div>
          </Link>
          <button
            type="button"
            aria-label="Delete post"
            onClick={() => deletePost(post)}
            disabled={deletingId === post.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: tokens.radius.button,
              border: 'none',
              background: 'transparent',
              color: tokens.colors.danger,
              cursor: deletingId === post.id ? 'default' : 'pointer',
              opacity: deletingId === post.id ? 0.5 : 1,
              flexShrink: 0,
            }}
          >
            <Trash2 size={16} />
          </button>
        </Card>
        )}</SortableCard>
      ))}
      </SortableContext>
      </DndContext>
    </div>
  )
}
