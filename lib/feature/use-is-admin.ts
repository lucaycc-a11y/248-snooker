'use client'

import { useEffect, useState } from 'react'

// Client hook: true only when the signed-in user is an active admin.
// Defaults to false so non-admins never see admin-only UI, not even briefly.
let cached: boolean | null = null
let inflight: Promise<boolean> | null = null

function load(): Promise<boolean> {
  if (!inflight) {
    inflight = fetch('/api/member/check-admin', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: unknown) => {
        const v =
          typeof j === 'object' && j !== null && 'isAdmin' in j && (j as { isAdmin: unknown }).isAdmin === true
        cached = v
        return v
      })
      .catch(() => false)
  }
  return inflight
}

export function useIsAdmin(): boolean {
  const [on, setOn] = useState<boolean>(cached ?? false)
  useEffect(() => {
    let alive = true
    load().then((v) => {
      if (alive) setOn(v)
    })
    return () => {
      alive = false
    }
  }, [])
  return on
}
