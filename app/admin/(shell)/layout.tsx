import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { AdminShell } from '@/components/admin/AdminShell'
import { getAdminData } from '@/lib/data/getAdmin'
import AdminTabBar from '@/components/admin/AdminTabBar'
import { TestModeBanner } from '@/components/admin/TestModePanel'

/**
 * Guarded admin shell.
 *
 * Everything under `app/admin/(shell)/` needs a signed-in, active admin.
 * `app/admin/login` and `app/admin/accept-invite` deliberately live OUTSIDE this
 * group — a route group does not change the URL, but it does change which
 * layouts run, and that is the only way to let a logged-out visitor reach the
 * login form. Putting the guard in `app/admin/layout.tsx` wrapped the login
 * page too and bounced every unauthenticated request to `/auth`.
 */
export default async function AdminShellLayout({
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
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  // Admin check: admin_users (active invite), same source as every admin API.
  // The old check read users.is_admin, a column that does not exist, so the
  // query errored and every admin was redirected to '/'.
  const admin = await getAdminData()
  if (!admin) {
    redirect('/')
  }

  const isSuperAdmin = admin.role === 'super_admin'

  return (
    <AdminShell admin={admin} isSuperAdmin={isSuperAdmin}>
      <TestModeBanner />
      <AdminTabBar />
      {children}
    </AdminShell>
  )
}
