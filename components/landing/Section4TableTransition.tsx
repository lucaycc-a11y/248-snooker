"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"

/**
 * Section 4 — Table 展示
 *
 * Scroll-pinned 4-stage crossfade: photo → text → text → photo.
 * Uses `position: sticky` (not GSAP ScrollTrigger — see Section2Value.tsx
 * comment for why: mobile Safari pin-spacing / resize bugs).
 *
 * Placeholder images — replace with real room photos when available:
 *   Table 1: /gallery/S2/part3_table_wide_room.png
 *   Table 2: /gallery/Space_Enternity.PNG
 */

const LAYERS = [
  // Layer 0 — Table 1 panorama
  { kind: "image" as const, src: "/gallery/S2/part3_table_wide_room.png", alt: "Space Infinity table panorama" },
  // Layer 1 — "Space Infinity" single-line text
  { kind: "text" as const, primary: "Space Infinity", primaryCms: "section4.infinity_label" },
  // Layer 2 — "Space Infinity" / "or Space Eternity" two-line text
  { kind: "text" as const, primary: "Space Infinity", primaryCms: "section4.infinity_label", secondary: "or Space Eternity", secondaryCms: "section4.or_eternity_label" },
  // Layer 3 — Table 2 (Eternity room)
  { kind: "image" as const, src: "/gallery/Space_Enternity.PNG", alt: "Space Eternity room" },
] as const

/**
 * Smoothstep: returns 0 outside [a,d], ramps 0→1 in [a,b], holds 1 in [b,c],
 * ramps 1→0 in [c,d].
 */
function smoothstep(x: number, a: number, b: number, c: number, d: number): number {
  if (x <= a) return 0
  if (x >= d) return 0
  if (x >= b && x <= c) return 1
  if (x < b) return (x - a) / (b - a)
  // x > c
  return (d - x) / (d - c)
}

/** Per-layer opacity thresholds: [fadeInStart, fadeInEnd, fadeOutStart, fadeOutEnd] */
const RANGES: [number, number, number, number][] = [
  [0.0, 0.0, 0.20, 0.30],   // Layer 0: visible from start, fades out 20-30%
  [0.22, 0.32, 0.42, 0.52], // Layer 1: fades in 22-32%, fades out 42-52%
  [0.44, 0.54, 0.64, 0.74], // Layer 2: fades in 44-54%, fades out 64-74%
  [0.66, 0.76, 1.0, 1.0],   // Layer 3: fades in 66-76%, holds to end
]

function layerOpacity(progress: number, i: number): number {
  const [a, b, c, d] = RANGES[i]
  return smoothstep(progress, a, b, c, d)
}

export default function Section4TableTransition() {
  const stageRef = useRef<HTMLDivElement>(null)
  const layerRefs = useRef<(HTMLDivElement | null)[]>([])
  const ticking = useRef(false)
  const reducedMotion = useRef(false)
  const [rmResolved, setRmResolved] = useState(false)

  // Check prefers-reduced-motion once
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    reducedMotion.current = mq.matches
    setRmResolved(true)
    const handler = (e: MediaQueryListEvent) => { reducedMotion.current = e.matches }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const update = (): void => {
      ticking.current = false
      const rect = stage.getBoundingClientRect()
      const total = stage.offsetHeight - window.innerHeight
      if (total <= 0) return

      const scrolled = Math.max(0, Math.min(total, -rect.top))
      const progress = scrolled / total

      if (reducedMotion.current) {
        // All layers fully visible — no crossfade
        layerRefs.current.forEach((el) => {
          if (el) el.style.opacity = "1"
        })
        return
      }

      layerRefs.current.forEach((el, i) => {
        if (el) el.style.opacity = layerOpacity(progress, i).toFixed(4)
      })
    }

    const onScroll = (): void => {
      if (!ticking.current) {
        ticking.current = true
        requestAnimationFrame(update)
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll, { passive: true })
    update() // initial paint

    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [])

  return (
    <section
      aria-label="Table showcase — Space Infinity and Space Eternity rooms"
      className="relative bg-black"
      style={{ height: "400vh" }}
    >
      {/* Pinned viewport — sticky inside the tall section */}
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* Absolutely-stacked layers, opacity-crossfaded by scroll progress */}
        {LAYERS.map((layer, i) => (
          <div
            key={i}
            ref={(el) => { layerRefs.current[i] = el }}
            className="absolute inset-0"
            style={{ opacity: rmResolved && reducedMotion.current ? 1 : 0 }}
            aria-hidden={layer.kind === "image"}
          >
            {layer.kind === "image" ? (
              <Image
                src={layer.src}
                alt={layer.alt}
                fill
                priority={i === 0}
                sizes="100vw"
                quality={80}
                className="object-cover"
              />
            ) : (
              /* Text layer — Good Times display font */
              <div className="flex h-full w-full items-center justify-center">
                {"secondary" in layer ? (
                  /* Two-line variant: "Space Infinity" / "or Space Eternity" */
                  <div className="text-center">
                    <span
                      data-cms-key={layer.primaryCms}
                      className="font-label block text-4xl tracking-[0.12em] text-white sm:text-6xl md:text-7xl lg:text-8xl"
                      style={{ fontFamily: '"Good Times", "Bebas Neue", sans-serif' }}
                    >
                      {layer.primary}
                    </span>
                    <span
                      data-cms-key={layer.secondaryCms}
                      className="font-label block text-lg tracking-[0.12em] text-white/60 sm:text-2xl md:text-3xl lg:text-4xl"
                      style={{ fontFamily: '"Good Times", "Bebas Neue", sans-serif' }}
                    >
                      {layer.secondary}
                    </span>
                  </div>
                ) : (
                  /* Single-line variant: "Space Infinity" */
                  <span
                    data-cms-key={layer.primaryCms}
                    className="font-label text-5xl tracking-[0.12em] text-white sm:text-7xl md:text-8xl lg:text-9xl"
                    style={{ fontFamily: '"Good Times", "Bebas Neue", sans-serif' }}
                  >
                    {layer.primary}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Subtle vignette overlay for cinematic feel */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20"
          aria-hidden="true"
        />
      </div>
    </section>
  )
}
