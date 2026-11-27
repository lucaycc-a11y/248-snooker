import { notFound } from 'next/navigation'
import { getServiceSupabase } from '@/lib/supabase/service'
import { adminTokens as tokens } from '@/lib/admin/admin-tokens'
import BlogEditorForm from '@/components/admin/BlogEditorForm'

async function getPost(id: string) {
  const service = getServiceSupabase()
  const { data } = await service.from('blog_posts').select('*').eq('id', id).maybeSingle()
  return data
}

// Other locale rows in the same translation group (see migration
// 20260712_blog_translation_group.sql) — lets the editor show which locales
// already have a sibling translation vs. which still need one.
async function getSiblings(translationGroupId: string | null, currentId: string) {
  // TODO: translation_group_id column doesn't exist yet (see docs/prompt5-db-requests.md)
  // Return empty array until column is added
  return []
}

export default async function AdminBlogEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const post = await getPost(id)
  if (!post) notFound()
  // TODO: translation_group_id doesn't exist yet, pass null
  const siblings = await getSiblings(null, id)

  return (
    <main style={{ maxWidth: 1240, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ marginBottom: 24 }}>
        <a href="/admin/blog" style={{ fontFamily: "'Good Times', 'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: tokens.colors.textMuted, textDecoration: 'none' }}>← Blog</a>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.text, margin: '8px 0 0' }}>編輯文章</h1>
      </div>
      <BlogEditorForm post={post} siblings={siblings} />
    </main>
  )
}
