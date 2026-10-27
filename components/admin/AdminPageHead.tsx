import type { ReactNode } from 'react'

/**
 * AdminPageHead — the one header every admin page uses under the shell title.
 *
 * The shell already prints the page title (h1). This row carries the subtitle
 * (what the page shows, when it last updated) and the page actions, so a page
 * must never repeat its own title.
 */
export default function AdminPageHead({
  sub,
  actions,
}: {
  sub?: ReactNode
  actions?: ReactNode
}) {
  if (!sub && !actions) return null
  return (
    <div className="admin-pagehead">
      <p className="sub">{sub}</p>
      {actions ? <div className="actions">{actions}</div> : null}
    </div>
  )
}
