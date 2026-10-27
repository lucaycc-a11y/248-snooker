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
  return (
    <>
      {/* Set the admin theme before first paint so light mode (the default)
          never flashes dark. Mirrors AdminShell: dark only if chosen. */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "try{var t=localStorage.getItem('theme');var d=document.documentElement;d.dataset.theme=t==='dark'?'dark':'light';d.style.colorScheme=d.dataset.theme}catch(e){document.documentElement.dataset.theme='light'}",
        }}
      />
      {children}
    </>
  )
}
