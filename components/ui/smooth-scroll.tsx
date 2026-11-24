'use client'

import { useEffect } from 'react'

/**
 * Inertial wheel scrolling for pages with scroll-driven scenes (Space Pilot).
 * Wheel input moves a target; the page eases towards it every frame.
 * Off for touch devices (native momentum is already smooth), reduced-motion users,
 * and wheel events over nested scrollers. Keyboard, scrollbar drag and anchor jumps stay native.
 */
export function SmoothScroll({ ease = 0.1 }: { ease?: number }) {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (reduce || !fine) return

    let target = window.scrollY
    let current = target
    let active = false
    let raf = 0

    const maxScroll = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
    const clamp = (v: number) => Math.min(Math.max(v, 0), maxScroll())

    const tick = () => {
      current += (target - current) * ease
      if (Math.abs(target - current) < 0.5) {
        current = target
        active = false
      }
      // 'instant' so a global `scroll-behavior: smooth` doesn't smooth the smoothing.
      window.scrollTo({ top: current, left: 0, behavior: 'instant' as ScrollBehavior })
      if (active) raf = requestAnimationFrame(tick)
    }

    const insideNestedScroller = (start: EventTarget | null): boolean => {
      let el = start instanceof HTMLElement ? start : null
      while (el && el !== document.body && el !== document.documentElement) {
        const oy = getComputedStyle(el).overflowY
        if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) return true
        el = el.parentElement
      }
      return false
    }

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.defaultPrevented || insideNestedScroller(e.target)) return
      e.preventDefault()
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1
      if (!active) {
        current = window.scrollY
        target = current
      }
      target = clamp(target + e.deltaY * unit)
      if (!active) {
        active = true
        raf = requestAnimationFrame(tick)
      }
    }

    // Keep in sync when something else moves the page (keyboard, scrollbar, anchors).
    const onScroll = () => {
      if (!active) {
        current = window.scrollY
        target = current
      }
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [ease])

  return null
}
