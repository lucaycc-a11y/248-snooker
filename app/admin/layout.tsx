import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { AdminShell } from '@/components/admin/AdminShell'
import { getAdminData } from '@/lib/data/getAdmin'
import '@/app/styles/admin-theme.css'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component restriction
          }
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  // Admin check: admin_users (active invite), same source as every admin API.
  // The old check read users.is_admin, a column that does not exist, so the
  // query errored and every admin was redirected to '/'.
  const admin = await getAdminData()
  if (!admin) {
    redirect('/')
  }

  const isSuperAdmin = admin.role === 'super_admin'

  return <AdminShell isSuperAdmin={isSuperAdmin}>{children}</AdminShell>
}
