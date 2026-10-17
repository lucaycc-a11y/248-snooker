'use client'

/**
 * DevRoleSwitcher — preview the shell as a different admin role.
 *
 * Renders ONLY when `NODE_ENV === 'development'`. The override is stored in
 * localStorage and read by AdminShell to filter `superAdminOnly` nav items,
 * so you can see what a plain `admin` sees without a second account.
 *
 * It never touches the real session — the server still enforces permissions.
 */

import { useCallback, useEffect, useState } from 'react'
import { FlaskConical } from 'lucide-react'

const STORAGE_KEY = 'admin-dev-role'
export type DevRoleOverride = 'super_admin' | 'admin' | null

export function readDevRoleOverride(): DevRoleOverride {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw === 'super_admin' || raw === 'admin' ? raw : null
  } catch {
    return null
  }
}

export default function DevRoleSwitcher() {
  const [override, setOverride] = useState<DevRoleOverride>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setOverride(readDevRoleOverride())
  }, [])

  const cycle = useCallback(() => {
    const next: DevRoleOverride =
      override === null ? 'admin' : override === 'admin' ? 'super_admin' : null
    try {
      if (next === null) window.localStorage.removeItem(STORAGE_KEY)
      else window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* storage unavailable — ignore */
    }
    setOverride(next)
    // Reload so AdminShell re-reads the override for nav filtering.
    window.location.reload()
  }, [override])

  // Hard gate: this must never appear in a production build.
  if (process.env.NODE_ENV !== 'development') return null
  if (!mounted) return null

  const label =
    override === null ? '角色：真實' : override === 'admin' ? '角色：admin' : '角色：super'

  return (
    <button
      type="button"
      onClick={cycle}
      className="flex min-h-[44px] items-center gap-3 rounded-[var(--admin-radius-input)] border px-3 text-sm"
      style={{
        borderColor: 'var(--admin-warning)',
        color: 'var(--admin-warning)',
      }}
      data-cms-key="admin.dev.role_switcher"
      title="僅限開發環境 — 不影響真實權限"
    >
      <FlaskConical className="h-4 w-4" aria-hidden />
      <span>{label}</span>
    </button>
  )
}
