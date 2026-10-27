// A template (unlike a layout) remounts on every navigation, so each admin page fades and
// rises in. The motion itself lives in admin-dash.css and is switched off for
// prefers-reduced-motion.
export default function AdminPageTemplate({ children }: { children: React.ReactNode }) {
  return <div className="ad-page-in">{children}</div>
}
