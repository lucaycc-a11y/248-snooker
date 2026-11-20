'use client'

import { useEffect, useState } from 'react'

// Client hook for the v8.0.2 admin-only gate. Defaults to false (old UI) until
// the server answers, so non-admins never flash the new UI.
let cached: boolean | null = null
let inflight: Promise<boolean> | null = null

function load(): Promise<boolean> {
  if (!inflight) {
    inflight = fetch('/api/feature-gate', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: unknown) => {
        const v =
          typeof j === 'object' && j !== null && 'v802' in j && (j as { v802: unknown }).v802 === true
        cached = v
        return v
      })
      .catch(() => false)
  }
  return inflight
}

export function useV802(): boolean {
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
