import { getServiceSupabase } from '@/lib/supabase/service'
import { tokens } from '@/app/styles/tokens'
import { Card } from '@/components/ui/Card'
import BlogAdminList from '@/components/admin/BlogAdminList'

async function getPosts() {
  const service = getServiceSupabase()
  const { data } = await service
    .from('blog_posts')
    .select('id, slug, locale, title, category, cover_image_url, published_at, ai_generated, created_at')
    .order('created_at', { ascending: false })
  return data ?? []
}

export default async function AdminBlogListPage() {
  const posts = await getPosts()

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: tokens.colors.text }}>Blog</h1>
      </div>
      <Card variant="gradient" style={{ marginBottom: tokens.spacing.lg, padding: tokens.spacing.md }}>
        <div style={{ fontSize: 13, color: tokens.colors.textMuted }}>
          Posts save as drafts. Use Publish on a post to make it live immediately — no separate build/deploy needed.
        </div>
      </Card>
      <BlogAdminList initialPosts={posts} />
    </main>
  )
}
