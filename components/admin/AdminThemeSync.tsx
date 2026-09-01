'use client'

/**
 * AdminThemeSync — resolves the admin's theme preference client-side.
 *
 * The server layout already sets a concrete `data-theme` on the wrapper div
 * for 'dark'/'light'. This client component only exists to honour the
 * 'system' preference (matchMedia) and to let the user flip the theme at
 * runtime from the sidebar. It also persists the choice back to the server.
 *
 * data-theme lives on the app wrapper <div> (set by the server layout), so
 * the CSS variables cascade with no flash-of-unstyled-content — no inline
 * <script> needed.
 */

import { useEffect, useState } from 'react'
import { useAdmin } from '@/lib/admin/AdminContext'
import type { AdminThemePreference } from '@/lib/data/getAdmin'

type AdminThemeSyncProps = {
  preference: AdminThemePreference
  resolved: 'dark' | 'light'
}

export default function AdminThemeSync({ preference, resolved }: AdminThemeSyncProps) {
  const admin = useAdmin()
  const [theme, setTheme] = useState<'dark' | 'light'>(resolved)

  useEffect(() => {
    if (preference !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => setTheme(mq.matches ? 'dark' : 'light')
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [preference])

  useEffect(() => {
    document.documentElement.setAttribute('data-admin-theme', theme)
    document.documentElement.style.colorScheme = theme
  }, [theme])

  return null
}
