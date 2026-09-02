"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Section 4 — Table 展示 (scroll-linked zoom animation)
 *
 * Apple-style text-mask zoom: a black overlay with text-shaped cutouts
 * scales from ~18x down to 1x, revealing abstract image texture through
 * letter edges, then transitions to solid gradient text, shows
 * "or / Space Eternity", and reverses with a second table image.
 *
 * v3 fixes:
 *   - Text overlap: solid/or/eternity now in a single flex-col group
 *   - Green band artifact: gradient widened 3× on "or" text
 *   - Zoom-in speed: compressed from 29% to 12% of scroll distance
 *   - Overflow clipping: removed overflow-hidden so text extends naturally
 *
 * Gradient values per Figma spec:
 *   Space Infinity: linear-gradient(90.13deg, #7C7878 2.61%, #DDDDDD 41.45%, #D2D2D2 62.51%, #7C7878 99.95%)
 *   or:             linear-gradient(90.13deg, #7C7878 2.61%, rgba(57,255,43,0.5) 9.58%, #DDDDDD 41.45%, #D2D2D2 62.51%, #7C7878 99.95%)
 *   Space Eternity: linear-gradient(90.13deg, #7C7878 2.61%, #DDDDDD 41.45%, #D2D2D2 62.51%, #7C7878 99.95%)
 */

/* ── Figma-accurate gradients ─────────────────────────────────── */

const GRADIENT_METALLIC =
  "linear-gradient(90.13deg, rgb(124,120,120) 2.6068%, rgb(221,221,221) 41.449%, rgb(210,210,210) 62.509%, rgb(124,120,120) 99.947%)"

const GRADIENT_OR =
  "linear-gradient(90.13deg, rgb(124,120,120) 2.6068%, rgba(57,255,43,0.5) 9.5794%, rgb(221,221,221) 41.449%, rgb(210,210,210) 62.509%, rgb(124,120,120) 99.947%)"

/* ── Shared font ─────────────────────────────────────────────── */

const FONT_FAMILY = "'Good Times', sans-serif"

const MASK_CLASS =
  "absolute inset-0 flex items-center justify-center select-none pointer-events-none"

/* ── Helpers ──────────────────────────────────────────────────── */

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v))

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export default function Section4TableTransition() {
  const sectionRef = useRef<HTMLElement>(null)
  const spacerRef = useRef<HTMLDivElement>(null)

  /* Layer refs */
  const table1ImgRef = useRef<HTMLDivElement>(null)
  const table2ImgRef = useRef<HTMLDivElement>(null)
  const maskText1Ref = useRef<HTMLDivElement>(null)
  const solidGroupRef = useRef<HTMLDivElement>(null)
  const orTextRef = useRef<HTMLDivElement>(null)
  const eternityTextRef = useRef<HTMLDivElement>(null)
  const maskText2Ref = useRef<HTMLDivElement>(null)

  const inView = useRef(false)
  const rafId = useRef(0)
  const [, setTick] = useState(0)

  /* ── Animation tick ──────────────────────────────────────────── */

  const animate = useCallback(() => {
    const spacer = spacerRef.current
    if (!spacer) return

    const rect = spacer.getBoundingClientRect()
    const vh = window.innerHeight

    let progress = 0
    if (rect.top <= 0) {
      const scrolled = -rect.top
      const scrollRange = spacer.offsetHeight - vh
      progress = clamp(scrolled / Math.max(scrollRange, 1), 0, 1)
    }

    /* ── Phase 1: Zoom In (0.00 → 0.19) ─────────────────────── */

    // Table 1: full image, fades out 0.02–0.06
    const table1Opacity =
      progress < 0.02 ? 1
        : progress < 0.06 ? lerp(1, 0, (progress - 0.02) / 0.04)
          : 0

    // Mask 1: fades in 0.02–0.05, scale 18→1 over 0.05–0.17, fades out 0.15–0.19
    const mask1Opacity =
      progress < 0.02 ? 0
        : progress < 0.05 ? lerp(0, 1, (progress - 0.02) / 0.03)
          : progress < 0.15 ? 1
            : progress < 0.19 ? lerp(1, 0, (progress - 0.15) / 0.04)
              : 0

    // Mask 1 SCALE: 18→1 over 0.05–0.17 (12% of scroll — fast zoom-in)
    const mask1Scale =
      progress < 0.05 ? 18
        : progress < 0.17 ? lerp(18, 1, (progress - 0.05) / 0.12)
          : 1

    /* ── Phase 2: Solid Text (0.15 → 0.45) ───────────────────── */

    // Solid group: fades in 0.15–0.19, visible, fades out 0.41–0.45
    const solidGroupOpacity =
      progress < 0.15 ? 0
        : progress < 0.19 ? lerp(0, 1, (progress - 0.15) / 0.04)
          : progress < 0.41 ? 1
            : progress < 0.45 ? lerp(1, 0, (progress - 0.41) / 0.04)
              : 0

    // "or" line: fades in 0.24–0.30, visible, fades out 0.41–0.45
    const orLineOpacity =
      progress < 0.24 ? 0
        : progress < 0.30 ? lerp(0, 1, (progress - 0.24) / 0.06)
          : progress < 0.41 ? 1
            : progress < 0.45 ? lerp(1, 0, (progress - 0.41) / 0.04)
              : 0

    // "Space Eternity" line: fades in 0.26–0.32, visible, fades out 0.41–0.45
    const eternityLineOpacity =
      progress < 0.26 ? 0
        : progress < 0.32 ? lerp(0, 1, (progress - 0.26) / 0.06)
          : progress < 0.41 ? 1
            : progress < 0.45 ? lerp(1, 0, (progress - 0.41) / 0.04)
              : 0

    /* ── Phase 3: Zoom Out (0.43 → 0.93) ─────────────────────── */

    // Mask 2: fades in 0.43–0.47, scale 1→18 over 0.47–0.90, fades out 0.90–0.93
    const mask2Opacity =
      progress < 0.43 ? 0
        : progress < 0.47 ? lerp(0, 1, (progress - 0.43) / 0.04)
          : progress < 0.90 ? 1
            : progress < 0.93 ? lerp(1, 0, (progress - 0.90) / 0.03)
              : 0

    // Mask 2 SCALE: 1→18 over 0.47–0.90
    const mask2Scale =
      progress < 0.47 ? 1
        : progress < 0.90 ? lerp(1, 18, (progress - 0.47) / 0.43)
          : 18

    /* ── Phase 4: End (0.90 → 1.00) ──────────────────────────── */

    // Table 2: full image, fades in 0.90–0.96
    const table2Opacity =
      progress < 0.90 ? 0
        : progress < 0.96 ? lerp(0, 1, (progress - 0.90) / 0.06)
          : 1

    /* ── Apply styles ────────────────────────────────────────── */

    const s = (el: HTMLElement | null, styles: Record<string, string>) => {
      if (!el) return
      for (const [k, v] of Object.entries(styles)) {
        el.style.setProperty(k, v)
      }
    }

    s(table1ImgRef.current, { opacity: String(table1Opacity) })
    s(table2ImgRef.current, { opacity: String(table2Opacity) })

    s(maskText1Ref.current, {
      opacity: String(mask1Opacity),
      transform: `scale(${mask1Scale})`,
    })

    // Solid group: overall opacity for crossfade with mask layers
    s(solidGroupRef.current, { opacity: String(solidGroupOpacity) })
    // Individual line opacity for staggered appearance within the group
    s(orTextRef.current, { opacity: String(orLineOpacity) })
    s(eternityTextRef.current, { opacity: String(eternityLineOpacity) })

    s(maskText2Ref.current, {
      opacity: String(mask2Opacity),
      transform: `scale(${mask2Scale})`,
    })

    rafId.current = requestAnimationFrame(animate)
  }, [])

  /* ── Scroll observer ─────────────────────────────────────────── */

  useEffect(() => {
    const section = sectionRef.current
    const spacer = spacerRef.current
    if (!section || !spacer) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const nowVisible = entry.isIntersecting && entry.intersectionRatio > 0.01

        if (nowVisible && !inView.current) {
          inView.current = true
          section.style.position = "fixed"
          section.style.top = "0"
          section.style.left = "0"
          section.style.width = "100%"
          section.style.height = "100vh"
          section.style.zIndex = "40"
          rafId.current = requestAnimationFrame(animate)
        } else if (!nowVisible && inView.current) {
          inView.current = false
          section.style.position = ""
          section.style.top = ""
          section.style.left = ""
          section.style.width = ""
          section.style.height = ""
          section.style.zIndex = ""
          cancelAnimationFrame(rafId.current)
          setTick((t) => t + 1)
        }
      },
      { threshold: [0, 0.01, 0.05] },
    )

    observer.observe(spacer)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(rafId.current)
    }
  }, [animate])

  return (
    <>
      {/* Spacer: scroll distance for animation */}
      <div ref={spacerRef} className="h-[500vh] max-md:h-[300vh]" aria-hidden="true" />

      <section
        ref={sectionRef}
        aria-label="Table showcase — Space Infinity and Space Eternity rooms"
        className="relative h-screen bg-black"
        data-cms-key="section4.table-transition"
      >
        {/* Layer 0: Table 1 full panorama */}
        <div
          ref={table1ImgRef}
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('/gallery/Space_Infinity.PNG')",
            opacity: 1,
          }}
        />

        {/* Layer 1: Table 2 full panorama */}
        <div
          ref={table2ImgRef}
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('/gallery/Space_Enternity.PNG')",
            opacity: 0,
          }}
        />

        {/* Layer 2: Mask Text 1 — Table 1 image through text letterforms (scale 18→1) */}
        <div
          ref={maskText1Ref}
          className={`${MASK_CLASS} text-[clamp(3rem,12vw,9rem)] uppercase tracking-wider whitespace-nowrap`}
          style={{
            opacity: 0,
            fontFamily: FONT_FAMILY,
            backgroundSize: "cover",
            backgroundPosition: "center",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            backgroundImage: "url('/gallery/Space_Infinity.PNG')",
            transformOrigin: "center center",
          }}
          data-cms-key="section4.space-infinity"
        >
          Space Infinity
        </div>

        {/* Layer 3: Solid text group — gradient text stacked vertically
            FIX: single flex-col container eliminates overlap between
            "Space Infinity", "or", and "Space Eternity" lines. */}
        <div
          ref={solidGroupRef}
          className="absolute inset-0 flex flex-col items-center justify-center select-none pointer-events-none gap-1"
          style={{ opacity: 0 }}
        >
          {/* Line 1: Space Infinity — metallic gradient */}
          <div
            className="text-[clamp(3rem,12vw,9rem)] uppercase tracking-wider whitespace-nowrap"
            style={{
              fontFamily: FONT_FAMILY,
              backgroundImage: GRADIENT_METALLIC,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
            data-cms-key="section4.space-infinity-gradient"
          >
            Space Infinity
          </div>

          {/* Line 2: or — green accent gradient
              FIX: background-size 300% widens the gradient across 3× the element
              width, preventing the green color stop from appearing as a sharp
              vertical band on the short "or" text. */}
          <div
            ref={orTextRef}
            className="text-[clamp(1.5rem,4vw,3rem)] uppercase tracking-wider whitespace-nowrap"
            style={{
              opacity: 0,
              fontFamily: FONT_FAMILY,
              backgroundImage: GRADIENT_OR,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              backgroundSize: "300% 100%",
              backgroundPosition: "center center",
            }}
            data-cms-key="section4.or-text"
          >
            or
          </div>

          {/* Line 3: Space Eternity — metallic gradient */}
          <div
            ref={eternityTextRef}
            className="text-[clamp(2.5rem,8vw,7rem)] uppercase tracking-wider whitespace-nowrap"
            style={{
              opacity: 0,
              fontFamily: FONT_FAMILY,
              backgroundImage: GRADIENT_METALLIC,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
            data-cms-key="section4.space-eternity"
          >
            Space Eternity
          </div>
        </div>

        {/* Layer 4: Mask Text 2 — Table 2 image through text letterforms (scale 1→18) */}
        <div
          ref={maskText2Ref}
          className={`${MASK_CLASS} text-[clamp(3rem,12vw,9rem)] uppercase tracking-wider whitespace-nowrap`}
          style={{
            opacity: 0,
            fontFamily: FONT_FAMILY,
            backgroundSize: "cover",
            backgroundPosition: "center",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            backgroundImage: "url('/gallery/Space_Enternity.PNG')",
            transformOrigin: "center center",
          }}
          data-cms-key="section4.space-eternity-mask"
        >
          Space Eternity
        </div>
      </section>
    </>
  )
}
