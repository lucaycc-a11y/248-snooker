import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { AdminProvider } from '@/lib/admin/AdminContext'
import AdminSidebar from '@/components/admin/AdminSidebar'
import AdminAIPanel from '@/components/admin/AdminAIPanel'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminData()

  if (!admin) {
    // Not-logged-in and logged-in-but-not-admin get different destinations:
    // the latter is a silent redirect home with no error message, so a
    // logged-in non-admin can't confirm /admin exists.
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    redirect(user ? '/' : '/login?returnUrl=/admin')
  }

  return (
    <AdminProvider value={admin}>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <AdminSidebar />
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      </div>
      <AdminAIPanel />
    </AdminProvider>
  )
}
