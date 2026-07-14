'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Single Realtime subscription for the whole page tree (not one per CMSText
// instance) — opens one 'cms_content_changes' channel filtered to the
// current locale, keeps a key->value map in context. Seeded keys arrive via
// postgres_changes INSERT/UPDATE events; useCMSValue() reads the map and
// falls back to its own fallback string when a key isn't present yet.

type CMSMap = Record<string, string>

type CMSContextValue = {
  map: CMSMap
  locale: string
  seededKeys: React.MutableRefObject<Set<string>>
}

const CMSContext = createContext<CMSContextValue | null>(null)

export function CMSProvider({
  initialMap,
  locale,
  children,
}: {
  initialMap: CMSMap
  locale: string
  children: React.ReactNode
}) {
  const [map, setMap] = useState<CMSMap>(initialMap)
  const seededKeys = useRef<Set<string>>(new Set())

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`cms_content_changes_${locale}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cms_content', filter: `locale=eq.${locale}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as { key?: string; value?: string } | null
          if (!row?.key) return
          if (payload.eventType === 'DELETE') {
            setMap((prev) => {
              const next = { ...prev }
              delete next[row.key as string]
              return next
            })
            return
          }
          if (typeof row.value !== 'string') return
          setMap((prev) => ({ ...prev, [row.key as string]: row.value as string }))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [locale])

  const value = useMemo(() => ({ map, locale, seededKeys }), [map, locale])

  return <CMSContext.Provider value={value}>{children}</CMSContext.Provider>
}

export function useCMS(): CMSContextValue {
  const ctx = useContext(CMSContext)
  if (!ctx) throw new Error('useCMS() called outside CMSProvider')
  return ctx
}

// Reads the live value for `key`, falling back to `fallback` (the current-
// locale next-intl string) when no DB override exists yet. Fires a one-time
// seed POST per key per session so cms_content gets populated as visitors
// browse, without ever showing a blank field.
export function useCMSValue(key: string, fallback: string): string {
  const { map, locale, seededKeys } = useCMS()
  const value = map[key]

  useEffect(() => {
    if (value !== undefined) return
    if (seededKeys.current.has(key)) return
    seededKeys.current.add(key)

    fetch('/api/cms/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, locale, value: fallback }),
    }).catch(() => {
      // Best-effort — a failed seed just means this key stays on fallback
      // until the next page load retries.
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, value, locale])

  return value ?? fallback
}
