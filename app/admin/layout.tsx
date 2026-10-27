import '@/app/styles/admin-theme.css'
import '@/app/styles/admin-glass.css'
import '@/app/styles/admin-dash.css'

/**
 * Admin root layout — tokens only.
 *
 * No auth guard here. This layout wraps EVERY `/admin/*` URL including
 * `/admin/login`, so a `redirect()` for signed-out visitors would make the
 * login form unreachable. The guard lives in `app/admin/(shell)/layout.tsx`,
 * which covers every route except `/admin/login` and `/admin/accept-invite`.
 */
export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
