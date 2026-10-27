import { getServiceSupabase } from '@/lib/supabase/service'
import { adminTokens as tokens } from '@/lib/admin/admin-tokens'
import { Card } from '@/components/ui/card'
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
    <div className="admin-stack">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
      </div>
      <Card className="p-4" style={{ marginBottom: tokens.spacing.lg }}>
        <div style={{ fontSize: 13, color: tokens.colors.textMuted }}>
          Posts save as drafts. Use Publish on a post to make it live immediately — no separate build/deploy needed.
        </div>
      </Card>
      <BlogAdminList initialPosts={posts} />
    </div>
  )
}
