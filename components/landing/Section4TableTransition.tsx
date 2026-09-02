"use client"

import { useEffect, useRef } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger)
}

/**
 * Section 4 — Table 展示 (scroll-linked zoom animation)
 *
 * Apple-style text-mask zoom: a black overlay with text-shaped cutouts
 * scales from ~18x down to 1x, revealing abstract image texture through
 * letter edges, then transitions to solid gradient text, shows
 * "or / Space Eternity", and reverses with a second table image.
 *
 * v4: GSAP ScrollTrigger + scrub-based crossfade
 *   - "Space Infinity" fades to 0.18 (stays faintly visible)
 *   - "Or Space Eternity" fades 0→1 scrub-driven
 *   - Replaces IntersectionObserver + rAF with single GSAP timeline
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
  const spaceInfinityRef = useRef<HTMLDivElement>(null)
  const orTextRef = useRef<HTMLDivElement>(null)
  const eternityTextRef = useRef<HTMLDivElement>(null)
  const maskText2Ref = useRef<HTMLDivElement>(null)

  /* ── GSAP ScrollTrigger setup ───────────────────────────────── */

  useEffect(() => {
    const spacer = spacerRef.current
    const section = sectionRef.current
    if (!spacer || !section) return

    // Clear initial inline opacity values so GSAP can take full control
    gsap.set(section, { clearProps: "opacity" })
    gsap.set(spaceInfinityRef.current, { clearProps: "opacity" })
    gsap.set(orTextRef.current, { clearProps: "opacity" })
    gsap.set(eternityTextRef.current, { clearProps: "opacity" })

    // Build the master timeline pinned to scroll
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: spacer,
        start: "top top",
        end: "bottom bottom",
        pin: section,
        scrub: true,
      },
    })

    /* ── Phase 1: Zoom In (0 → 0.19) ─────────────────────────── */

    // Table 1 full image: fades out 0.00–0.03
    tl.to(table1ImgRef.current, { opacity: 0, duration: 0.03 }, 0)

    // Mask 1: fades in 0.00–0.03, scale 18→1 over 0.05–0.17 (12% of scroll — fast zoom-in)
    tl.to(maskText1Ref.current, { opacity: 1, duration: 0.03 }, 0)
    tl.to(maskText1Ref.current, { scale: 1, duration: 0.12, ease: "none" }, 0.05)

    // Mask 1: fades out 0.15–0.19
    tl.to(maskText1Ref.current, { opacity: 0, duration: 0.04 }, 0.15)

    /* ── Phase 3: Zoom Out (0.43 → 0.93) ─────────────────────── */

    // Mask 2: fades in 0.43–0.47
    tl.to(maskText2Ref.current, { opacity: 1, duration: 0.04 }, 0.43)

    // Mask 2: scale 1→18 over 0.47–0.90
    tl.to(maskText2Ref.current, { scale: 18, duration: 0.43, ease: "none" }, 0.47)

    // Mask 2: fades out 0.90–0.93
    tl.to(maskText2Ref.current, { opacity: 0, duration: 0.03 }, 0.90)

    /* ── Phase 4: End (0.90 → 1.00) ──────────────────────────── */

    // Table 2: full image fades in 0.90–0.96
    tl.to(table2ImgRef.current, { opacity: 1, duration: 0.06 }, 0.90)

    /* ─── SCRUB-BASED OPACITY (Apple HomePod-style scroll reveal) ─── */
    // Space Infinity fades to 0.18, Or+Space Eternity fade 0→1
    // Both driven by scroll position — speed follows scroll exactly

    tl.eventCallback("onUpdate", () => {
      const p = tl.progress()

      // Space Infinity: 1 → 0.18 (0.15→0.30), hold at 0.18 (0.30→0.43), fade to 0 (0.43→0.47)
      const infinityOpacity =
        p < 0.15 ? 0
          : p < 0.30 ? lerp(1, 0.18, (p - 0.15) / 0.15)
            : p < 0.43 ? 0.18
              : p < 0.47 ? lerp(0.18, 0, (p - 0.43) / 0.04)
                : 0
      if (spaceInfinityRef.current) {
        spaceInfinityRef.current.style.opacity = String(infinityOpacity)
      }

      // Or + Space Eternity: 0→1 scrub (0.15→0.30), hold (0.30→0.41), 1→0 (0.41→0.47)
      const crossfadeOpacity =
        p < 0.15 ? 0
          : p < 0.30 ? lerp(0, 1, (p - 0.15) / 0.15)
            : p < 0.41 ? 1
              : p < 0.47 ? lerp(1, 0, (p - 0.41) / 0.06)
                : 0
      if (orTextRef.current) {
        orTextRef.current.style.opacity = String(crossfadeOpacity)
      }
      if (eternityTextRef.current) {
        eternityTextRef.current.style.opacity = String(crossfadeOpacity)
      }
    })

    return () => {
      tl.scrollTrigger?.kill()
      tl.kill()
    }
  }, [])

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
          className="absolute inset-0 flex flex-col items-center justify-center select-none pointer-events-none gap-1"
        >
          {/* Line 1: Space Infinity — metallic gradient
              GSAP controls opacity via spaceInfinityRef (1→0.18 scrub) */}
          <div
            ref={spaceInfinityRef}
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
              vertical band on the short "or" text.
              GSAP controls opacity via orTextRef (0→1 scrub crossfade) */}
          <div
            ref={orTextRef}
            className="text-[clamp(1.5rem,4vw,3rem)] uppercase tracking-wider whitespace-nowrap"
            style={{
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

          {/* Line 3: Space Eternity — metallic gradient
              GSAP controls opacity via eternityTextRef (0→1 scrub crossfade) */}
          <div
            ref={eternityTextRef}
            className="text-[clamp(2.5rem,8vw,7rem)] uppercase tracking-wider whitespace-nowrap"
            style={{
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
