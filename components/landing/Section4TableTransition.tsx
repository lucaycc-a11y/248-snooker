"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"

/**
 * Section 4 — Table 展示
 *
 * Apple-style "text over blurred background" effect:
 *   Stage 1 (0–25%):  Table 1 — sharp, no text
 *   Stage 2 (25–50%): Table 1 blurs + darkens; "Space Infinity" fades in over it
 *   Stage 3 (50–70%): "or Space Eternity" fades in below
 *   Stage 4 (70–100%): Text fades out, Table 1 fades out, Table 2 fades in sharp
 *
 * Uses `position: sticky` (not GSAP ScrollTrigger — see Section2Value.tsx
 * comment for why: mobile Safari pin-spacing / resize bugs).
 *
 * Placeholder images — replace with real room photos when available:
 *   Table 1: /gallery/S2/part3_table_wide_room.png
 *   Table 2: /gallery/Space_Enternity.PNG
 */

/* ─── helpers ─────────────────────────────────────────────────────────── */

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/**
 * Smoothstep: ramp 0→1 in [a,b], hold 1 in [b,c], ramp 1→0 in [c,d].
 * Returns 0 outside [a,d].
 */
function smoothstep(x: number, a: number, b: number, c: number, d: number): number {
  if (x <= a) return 0
  if (x >= d) return 0
  if (x >= b && x <= c) return 1
  if (x < b) return (x - a) / (b - a)
  return (d - x) / (d - c)
}

/* ─── animation ranges ────────────────────────────────────────────────── */

/** Table 1 image: sharp at start, blurs during stages 2–3, fades out at stage 4. */
function table1Blur(progress: number): number {
  // 0 → 25%:  blur 0 (sharp)
  // 25 → 55%: blur ramps 0 → 20px
  // 55 → 70%: blur holds at 20px
  // (image fades out via opacity separately)
  return smoothstep(progress, 0.25, 0.55, 0.75, 0.75) * 20
}

/** Table 1 opacity: stays visible through stages 1–3, fades out in stage 4. */
function table1Opacity(progress: number): number {
  // 1.0 from 0–66%, fades to 0 from 66–80%
  return smoothstep(progress, 0.0, 0.0, 0.66, 0.80)
}

/** Dark overlay to ensure white text readability on blurred image. */
function overlayOpacity(progress: number): number {
  // 0 from 0–22%, ramps to 0.55 from 22–35%
  // holds at 0.55 from 35–68%, fades to 0 from 68–80%
  return smoothstep(progress, 0.22, 0.35, 0.68, 0.80) * 0.55
}

/** "Space Infinity" text: fades in at stage 2, fades out at stage 4. */
function textInfinityOpacity(progress: number): number {
  return smoothstep(progress, 0.25, 0.35, 0.68, 0.78)
}

/** "or Space Eternity" text: fades in at stage 3, fades out at stage 4. */
function textEternityOpacity(progress: number): number {
  return smoothstep(progress, 0.48, 0.58, 0.68, 0.78)
}

/** Table 2 image: fades in during stage 4, fully sharp. */
function table2Opacity(progress: number): number {
  return smoothstep(progress, 0.72, 0.82, 1.0, 1.0)
}

/* ─── component ───────────────────────────────────────────────────────── */

export default function Section4TableTransition() {
  const stageRef = useRef<HTMLDivElement>(null)
  const table1Ref = useRef<HTMLDivElement>(null)
  const table2Ref = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const textInfRef = useRef<HTMLDivElement>(null)
  const textEterRef = useRef<HTMLDivElement>(null)
  const ticking = useRef(false)
  const reducedMotion = useRef(false)
  const [rmResolved, setRmResolved] = useState(false)

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
        // All layers visible, no blur — accessible fallback
        const t1 = table1Ref.current
        const t2 = table2Ref.current
        const ov = overlayRef.current
        const ti = textInfRef.current
        const te = textEterRef.current
        if (t1) { t1.style.opacity = "1"; t1.style.filter = "none" }
        if (t2) t2.style.opacity = "1"
        if (ov) ov.style.opacity = "0"
        if (ti) ti.style.opacity = "1"
        if (te) te.style.opacity = "1"
        return
      }

      const t1 = table1Ref.current
      const t2 = table2Ref.current
      const ov = overlayRef.current
      const ti = textInfRef.current
      const te = textEterRef.current

      if (t1) {
        t1.style.opacity = table1Opacity(progress).toFixed(4)
        t1.style.filter = `blur(${table1Blur(progress).toFixed(1)}px)`
      }
      if (t2) t2.style.opacity = table2Opacity(progress).toFixed(4)
      if (ov) ov.style.opacity = overlayOpacity(progress).toFixed(4)
      if (ti) ti.style.opacity = textInfinityOpacity(progress).toFixed(4)
      if (te) te.style.opacity = textEternityOpacity(progress).toFixed(4)
    }

    const onScroll = (): void => {
      if (!ticking.current) {
        ticking.current = true
        requestAnimationFrame(update)
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll, { passive: true })
    update() // initial paint — sets Table 1 fully visible

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
        {/* Layer 0: Table 1 — initial opacity 1, always visible at start */}
        <div
          ref={table1Ref}
          className="absolute inset-0"
          style={{ opacity: 1 }}
          aria-hidden="true"
        >
          <Image
            src="/gallery/S2/part3_table_wide_room.png"
            alt="Space Infinity table panorama"
            fill
            priority
            sizes="100vw"
            quality={80}
            className="object-cover"
          />
        </div>

        {/* Layer 1: Table 2 — initial opacity 0, fades in at stage 4 */}
        <div
          ref={table2Ref}
          className="absolute inset-0"
          style={{ opacity: 0 }}
          aria-hidden="true"
        >
          <Image
            src="/gallery/Space_Enternity.PNG"
            alt="Space Eternity room"
            fill
            sizes="100vw"
            quality={80}
            className="object-cover"
          />
        </div>

        {/* Dark overlay — ensures white text readability on blurred image */}
        <div
          ref={overlayRef}
          className="absolute inset-0 bg-black"
          style={{ opacity: 0 }}
          aria-hidden="true"
        />

        {/* Text layer — z-10 to sit above images and overlay */}
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center">
          {/* "Space Infinity" — fades in at 25%, out at 68% */}
          <div
            ref={textInfRef}
            className="text-center"
            style={{ opacity: 0 }}
          >
            <span
              data-cms-key="section4.infinity_label"
              className="font-label block text-4xl tracking-[0.12em] text-white sm:text-6xl md:text-7xl lg:text-8xl"
              style={{ fontFamily: '"Good Times", "Bebas Neue", sans-serif' }}
            >
              Space Infinity
            </span>
          </div>

          {/* "or Space Eternity" — fades in at 48%, out at 68% */}
          <div
            ref={textEterRef}
            className="text-center mt-3"
            style={{ opacity: 0 }}
          >
            <span
              data-cms-key="section4.or_eternity_label"
              className="font-label block text-lg tracking-[0.12em] text-white/70 sm:text-2xl md:text-3xl lg:text-4xl"
              style={{ fontFamily: '"Good Times", "Bebas Neue", sans-serif' }}
            >
              or Space Eternity
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
