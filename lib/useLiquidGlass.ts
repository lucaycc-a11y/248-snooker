'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { LiquidGlass } from '@ybouane/liquidglass'

export function useLiquidGlass(rootRef: RefObject<HTMLElement>, glassSelector: string) {
  const instanceRef = useRef<LiquidGlass | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const root = rootRef.current
    if (!root) return

    ;(async () => {
      try {
        const glassElements = root.querySelectorAll(glassSelector)
        if (glassElements.length === 0) {
          if (!cancelled) setLoading(false)
          return
        }

        const instance = await LiquidGlass.init({
          root,
          glassElements: Array.from(glassElements) as HTMLElement[],
        })

        if (cancelled) {
          instance.destroy()
          return
        }

        instanceRef.current = instance
        setLoading(false)
      } catch (error) {
        if (!cancelled) {
          console.error('[useLiquidGlass] init failed:', error)
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
      if (instanceRef.current) {
        instanceRef.current.destroy()
        instanceRef.current = null
      }
    }
  }, [rootRef, glassSelector])

  return { loading, instance: instanceRef.current }
}
