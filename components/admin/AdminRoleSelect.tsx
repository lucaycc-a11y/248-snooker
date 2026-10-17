'use client'

/**
 * AdminRoleSelect — the top-bar `#role-sel` from `space8-admin.html`.
 *
 * A pill `<select>` with the two role names. Same markup and styling in every
 * environment so the top bar is pixel-identical; only the behaviour differs:
 * in development it is a role preview (writes a localStorage override that
 * AdminShell uses to filter `superAdminOnly` nav items), in production it is
 * disabled and simply displays the signed-in admin's real role.
 *
 * Role preview is a dev affordance only (Luca's instruction). The server still
 * enforces real permissions either way.
 */

import { useCallback, useState, type ChangeEvent } from 'react'
import { useAdminToast } from './ToastProvider'

export type AdminRoleId = 'super_admin' | 'admin'

const STORAGE_KEY = 'admin-dev-role'

export type DevRoleOverride = AdminRoleId | null

export function readDevRoleOverride(): DevRoleOverride {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw === 'super_admin' || raw === 'admin' ? raw : null
  } catch {
    return null
  }
}

function writeDevRoleOverride(next: DevRoleOverride): void {
  try {
    if (next === null) window.localStorage.removeItem(STORAGE_KEY)
    else window.localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* storage unavailable — ignore */
  }
}

export default function AdminRoleSelect({
  role,
  onRoleChange,
  disabled = false,
}: {
  /** Effective role — real role, or the dev override when one is set. */
  role: AdminRoleId
  /** Dev-only. Omit in production so the control cannot change anything. */
  onRoleChange?: (next: AdminRoleId) => void
  disabled?: boolean
}) {
  const { show } = useAdminToast()
  const [value, setValue] = useState<AdminRoleId | null>(null)

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const next = e.target.value
      if (next !== 'super_admin' && next !== 'admin') return
      setValue(next)
      writeDevRoleOverride(next)
      onRoleChange?.(next)
      // Prototype: toast('已切換為…', '預覽權限差異')
      show({
        message: next === 'super_admin' ? '已切換為超級管理員' : '已切換為管理員',
        detail: '預覽權限差異',
      })
    },
    [onRoleChange, show],
  )

  return (
    <>
      <label className="admin-sr" htmlFor="admin-role-sel">
        身份預覽
      </label>
      <select
        id="admin-role-sel"
        className="admin-sel admin-role-sel"
        value={value ?? role}
        disabled={disabled}
        onChange={handleChange}
        data-cms-key="admin.nav.role"
      >
        <option value="super_admin">超級管理員</option>
        <option value="admin">管理員</option>
      </select>
    </>
  )
}
