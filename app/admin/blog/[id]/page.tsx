import { notFound } from 'next/navigation'
import { getServiceSupabase } from '@/lib/supabase/service'
import { tokens } from '@/app/styles/tokens'
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
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: tokens.colors.text, marginBottom: 24 }}>Edit post</h1>
      <BlogEditorForm post={post} siblings={siblings} />
    </main>
  )
}
