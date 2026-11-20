'use client'

// Christmas preview for chosen admins only. Asks /api/christmas once after load;
// anonymous visitors never trigger the request (no Supabase session cookie).
// When enabled: soft falling snow, Christmas wording swapped in the browser, and
// a small "preview" badge. Nothing is rendered or stored for anyone else.

import { useEffect, useState } from 'react'
import { useLocale } from 'next-intl'

type Pair = readonly [string, string]
type Flake = { x: number; y: number; r: number; s: number; d: number }

function parse(json: unknown): Pair[] | null {
  if (typeof json !== 'object' || json === null) return null
  const rec = json as { enabled?: unknown; pairs?: unknown }
  if (rec.enabled !== true) return null
  if (!Array.isArray(rec.pairs)) return []
  return rec.pairs.filter(
    (p): p is Pair => Array.isArray(p) && p.length === 2 && typeof p[0] === 'string' && typeof p[1] === 'string',
  )
}

function swapText(root: Node, pairs: Pair[]): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    const text = node.nodeValue ?? ''
    const trimmed = text.trim()
    for (const [from, to] of pairs) {
      if (trimmed === from) {
        node.nodeValue = text.replace(from, to)
        break
      }
    }
    node = walker.nextNode()
  }
}

export function ChristmasTheme() {
  const locale = useLocale()
  const [pairs, setPairs] = useState<Pair[] | null>(null)

  useEffect(() => {
    if (!document.cookie.includes('sb-')) return
    let cancelled = false
    fetch(`/api/christmas?locale=${encodeURIComponent(locale)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: unknown) => {
        if (!cancelled) setPairs(parse(j))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [locale])

  // wording
  useEffect(() => {
    if (!pairs || pairs.length === 0) return
    swapText(document.body, pairs)
    const obs = new MutationObserver(() => swapText(document.body, pairs))
    obs.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => obs.disconnect()
  }, [pairs])

  // snow
  useEffect(() => {
    if (!pairs) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = document.createElement('canvas')
    canvas.setAttribute('aria-hidden', 'true')
    canvas.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9998'
    document.body.appendChild(canvas)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let w = 0
    let h = 0
    let raf = 0
    const flakes: Flake[] = []
    const make = (anywhere: boolean): Flake => ({
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : -10,
      r: Math.random() * 2 + 1.2,
      s: Math.random() * 0.8 + 0.4,
      d: Math.random() * Math.PI * 2,
    })
    const resize = () => {
      w = canvas.width = window.innerWidth
      h = canvas.height = window.innerHeight
      const n = Math.min(70, Math.floor(w / 16))
      while (flakes.length < n) flakes.push(make(true))
      flakes.length = n
    }
    const tick = () => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#fff'
      ctx.shadowColor = 'rgba(0,0,0,0.25)'
      ctx.shadowBlur = 3
      ctx.beginPath()
      for (const f of flakes) {
        f.d += 0.01
        f.y += f.s
        f.x += Math.sin(f.d) * 0.5
        if (f.y > h + 10) Object.assign(f, make(false))
        ctx.moveTo(f.x + f.r, f.y)
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2)
      }
      ctx.fill()
      raf = requestAnimationFrame(tick)
    }
    resize()
    tick()
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      canvas.remove()
    }
  }, [pairs])

  if (!pairs) return null
  return (
    <div
      style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 9999, pointerEvents: 'none', background: '#7a1631', color: '#fff', font: '12px sans-serif', padding: '4px 10px', borderRadius: 999 }}
    >
      🎄 Christmas preview (admin only)
    </div>
  )
}
