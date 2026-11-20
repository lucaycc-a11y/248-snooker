import ChristmasAdminForm from '@/components/admin/ChristmasAdminForm'

// Auth is enforced by app/admin/layout.tsx; the API routes re-check super_admin.
export default function AdminChristmasPage() {
  return (
    <div className="admin-stack">
      <ChristmasAdminForm />
    </div>
  )
}
