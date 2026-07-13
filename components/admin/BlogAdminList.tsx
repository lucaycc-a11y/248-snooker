'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { tokens } from '@/app/styles/tokens'

type PostRow = {
  id: string
  slug: string
  locale: string
  title: string
  category: string | null
  cover_image_url: string | null
  published_at: string | null
  ai_generated: boolean
  created_at: string
}

export default function BlogAdminList({ initialPosts }: { initialPosts: PostRow[] }) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [posts, setPosts] = useState(initialPosts)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function createDraft() {
    setCreating(true)
    try {
      const res = await fetch('/api/admin/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled post', locale: 'zh-HK' }),
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
      <Button variant="primary" size="sm" leftIcon={<Plus size={16} />} onClick={createDraft} loading={creating} style={{ marginBottom: tokens.spacing.lg }}>
        New post
      </Button>

      {posts.length === 0 && (
        <Card>
          <div style={{ color: tokens.colors.textMuted, fontSize: 14 }}>No posts yet.</div>
        </Card>
      )}

      {posts.map((post) => (
        <Card key={post.id} style={{ marginBottom: tokens.spacing.sm, display: 'flex', alignItems: 'center', gap: tokens.spacing.md }}>
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
      ))}
    </div>
  )
}
