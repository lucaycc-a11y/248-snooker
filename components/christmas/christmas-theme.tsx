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


// Christmas colours, applied only while the theme is on (html[data-xmas="on"]).
// Red + pine green + warm gold. Scoped by selector so nothing changes for anyone else.
const XMAS_CSS = `
html[data-xmas="on"]{
  --brand:#c8333f;--brand-hover:#a82733;--brand-dim:rgba(200,51,63,.14);--brand-text:#fff;
  --link:#e0525d;
  --primary:355 62% 48%;--primary-foreground:0 0% 100%;
}
/* Hero headline: same words, Christmas gradient (red, gold, cream, pine green) */
html[data-xmas="on"] h1[data-anime-hero-item]{
  background-image:linear-gradient(100deg,#ff6b6b 5%,#e0525d 22%,#f2c46d 42%,#fff4dc 52%,#8fd6a4 64%,#3fae6a 80%,#1f7a4a 100%)!important;
}
/* Hero booking button */
html[data-xmas="on"] a[href$="/book"].rounded-full.font-bold{
  background:linear-gradient(180deg,#d9444f,#a82733)!important;color:#fff!important;
}
/* Pricing section */
html[data-xmas="on"] .pricing-section{background:#fbf5ef!important}
html[data-xmas="on"] .pricing-title,
html[data-xmas="on"] .pricing-eyebrow{color:#a8232f!important}
html[data-xmas="on"] .pricing-card{border-color:rgba(168,35,47,.18)!important}
html[data-xmas="on"] .pricing-card--featured{border-color:#c8333f!important}
html[data-xmas="on"] .pricing-badge{background:#c8333f!important}
html[data-xmas="on"] .pricing-icon-wrap{background:rgba(200,51,63,.12)!important}
html[data-xmas="on"] .pricing-icon-wrap svg{color:#c8333f!important}
html[data-xmas="on"] .pricing-combo{color:#1f7a4a!important}
html[data-xmas="on"] .pricing-section .apple-button--primary{
  background:linear-gradient(180deg,#d9444f,#a82733)!important;color:#fff!important;
}
@media (prefers-color-scheme:dark){
  html[data-xmas="on"] .pricing-section{background:#0b1a12!important}
  html[data-xmas="on"] .pricing-title,
  html[data-xmas="on"] .pricing-eyebrow{color:#ff8a8a!important}
  html[data-xmas="on"] .pricing-combo{color:#7ddb9c!important}
}
`

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

  // colours: mark <html> while the theme is on
  useEffect(() => {
    if (!pairs) return
    document.documentElement.setAttribute('data-xmas', 'on')
    return () => document.documentElement.removeAttribute('data-xmas')
  }, [pairs])

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
      r: Math.random() * 1 + 0.9,
      s: Math.random() * 0.4 + 0.3,
      d: Math.random() * Math.PI * 2,
    })
    const resize = () => {
      w = canvas.width = window.innerWidth
      h = canvas.height = window.innerHeight
      const n = Math.min(26, Math.floor(w / 28))
      while (flakes.length < n) flakes.push(make(true))
      flakes.length = n
    }
    const tick = () => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.shadowColor = 'rgba(0,0,0,0.12)'
      ctx.shadowBlur = 1
      ctx.beginPath()
      for (const f of flakes) {
        f.d += 0.01
        f.y += f.s
        f.x += Math.sin(f.d) * 0.3
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
    <>
    <style>{XMAS_CSS}</style>
    <div
      style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 9999, pointerEvents: 'none', background: '#7a1631', color: '#fff', font: '12px sans-serif', padding: '4px 10px', borderRadius: 999 }}
    >
      🎄 Christmas preview (admin only)
    </div>
    </>
  )
}
