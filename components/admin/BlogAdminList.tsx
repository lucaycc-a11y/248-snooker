'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
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

  return (
    <div>
      <Button variant="primary" size="sm" leftIcon={<Plus size={16} />} onClick={createDraft} loading={creating} style={{ marginBottom: tokens.spacing.lg }}>
        New post
      </Button>

      {initialPosts.length === 0 && (
        <Card>
          <div style={{ color: tokens.colors.textMuted, fontSize: 14 }}>No posts yet.</div>
        </Card>
      )}

      {initialPosts.map((post) => (
        <Link key={post.id} href={`/admin/blog/${post.id}`} style={{ textDecoration: 'none' }}>
          <Card style={{ marginBottom: tokens.spacing.sm, display: 'flex', alignItems: 'center', gap: tokens.spacing.md }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: tokens.colors.text, fontSize: 15, fontWeight: 600 }}>{post.title}</div>
              <div style={{ color: tokens.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                {post.locale} · {post.category ?? 'uncategorized'} · {post.published_at ? 'Published' : 'Draft'}
                {post.ai_generated && ' · AI'}
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  )
}
