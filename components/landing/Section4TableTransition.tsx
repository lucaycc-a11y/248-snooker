"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Section 4 — Table 展示 (11-state Figma-accurate scroll animation)
 *
 * Apple-style text-mask zoom: a black overlay with text-shaped cutouts
 * scales from ~18x down to 1x, revealing abstract image texture through
 * letter edges, then transitions to solid gradient text, shows
 * "or / Space Eternity", and reverses with a second table image.
 *
 * 11 animation states (scroll progress 0→1):
 *   1  (0.00) — Table 1 full panorama visible
 *   2  (0.05) — Mask fades in at scale 18, abstract texture through letters
 *   3  (0.20) — Mask scales to ~3x, text becoming recognizable
 *   4  (0.32) — Mask reaches scale 1, crossfades to solid gradient text on black
 *   5  (0.42) — "or / Space Eternity" appear with gradient fills at 0.5 opacity
 *   6  (0.50) — All three text lines repositioned compactly
 *   7  (0.58) — Reverse mask fades in at scale 1 with Table 2 texture
 *   8  (0.68) — Reverse mask scales to ~5x, Table 2 texture abstract
 *   9  (0.78) — Reverse mask scales to ~10x, mostly black
 *  10  (0.88) — Reverse mask at ~18x, nearly all black
 *  11  (1.00) — Table 2 full panorama visible
 *
 * Technique: text stays at CSS scale 1, acts as viewport mask via
 * `background-clip: text`. The image fills the section behind the text.
 * At scale 18, letter fragments are tiny → abstract texture. At scale 1,
 * full letterforms are readable with image visible inside.
 *
 * Gradient values per Figma spec:
 *   Space Infinity: linear-gradient(90.13deg, #7C7878 2.61%, #DDDDDD 41.45%, #D2D2D2 62.51%, #7C7878 99.95%)
 *   or:             linear-gradient(90.13deg, #7C7878 2.61%, rgba(57,255,43,0.5) 9.58%, #DDDDDD 41.45%, #D2D2D2 62.51%, #7C7878 99.95%)
 *   Space Eternity: linear-gradient(90.13deg, #7C7878 2.61%, #DDDDDD 41.45%, #D2D2D2 62.51%, #7C7878 99.95%)
 *
 * Placeholder images — replace with real room panoramas:
 *   Table 1: /gallery/Space_Infinity.PNG
 *   Table 2: /gallery/Space_Enternity.PNG
 */

/* ── Figma-accurate gradients ─────────────────────────────────── */

const GRADIENT_METALLIC =
  "linear-gradient(90.13deg, rgb(124,120,120) 2.6068%, rgb(221,221,221) 41.449%, rgb(210,210,210) 62.509%, rgb(124,120,120) 99.947%)"

const GRADIENT_OR =
  "linear-gradient(90.13deg, rgb(124,120,120) 2.6068%, rgba(57,255,43,0.5) 9.5794%, rgb(221,221,221) 41.449%, rgb(210,210,210) 62.509%, rgb(124,120,120) 99.947%)"

/* ── Shared font (not in Tailwind config, so inline) ───────────── */

const FONT_FAMILY = "'Good Times', sans-serif"

const TEXT_CLASS =
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
  const solidTextRef = useRef<HTMLDivElement>(null)
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

    /* ── State calculations (opacity + scale) ──────────────────── */

    // State 1→2: Table 1 fades out (0.00–0.10)
    const table1Opacity =
      progress < 0.03 ? 1
        : progress < 0.10 ? lerp(1, 0, (progress - 0.03) / 0.07)
          : 0

    // Mask Text 1 (Table 1 texture through text)
    // Fades in 0.03–0.08, visible 0.08–0.32, fades out 0.32–0.38
    const mask1Opacity =
      progress < 0.03 ? 0
        : progress < 0.08 ? lerp(0, 1, (progress - 0.03) / 0.05)
          : progress < 0.32 ? 1
            : progress < 0.38 ? lerp(1, 0, (progress - 0.32) / 0.06)
              : 0

    // Mask Text 1 SCALE: 18→1 over 0.03–0.32
    // At scale 18: letterforms are huge → abstract texture through tiny letter edges
    // At scale 3: text becoming recognizable (state 3)
    // At scale 1: full readable text with image inside (state 4)
    const mask1Scale =
      progress < 0.03 ? 18
        : progress < 0.32 ? lerp(18, 1, (progress - 0.03) / 0.29)
          : 1

    // Solid gradient text
    // Fades in 0.28–0.35, visible 0.35–0.56, fades out 0.56–0.62
    const solidOpacity =
      progress < 0.28 ? 0
        : progress < 0.35 ? lerp(0, 1, (progress - 0.28) / 0.07)
          : progress < 0.56 ? 1
            : progress < 0.62 ? lerp(1, 0, (progress - 0.56) / 0.06)
              : 0

    // "or" text (0.5 opacity, green accent gradient)
    // Fades in 0.38–0.44, visible 0.44–0.54, fades out 0.54–0.60
    const orOpacity =
      progress < 0.38 ? 0
        : progress < 0.44 ? lerp(0, 0.5, (progress - 0.38) / 0.06)
          : progress < 0.54 ? 0.5
            : progress < 0.60 ? lerp(0.5, 0, (progress - 0.54) / 0.06)
              : 0

    // "Space Eternity" text (0.5 opacity, metallic gradient)
    // Fades in 0.40–0.46, visible 0.46–0.54, fades out 0.54–0.60
    const eternityOpacity =
      progress < 0.40 ? 0
        : progress < 0.46 ? lerp(0, 0.5, (progress - 0.40) / 0.06)
          : progress < 0.54 ? 0.5
            : progress < 0.60 ? lerp(0.5, 0, (progress - 0.54) / 0.06)
              : 0

    // Mask Text 2 (Table 2 texture through text)
    // Fades in 0.56–0.62, visible 0.62–0.90, fades out 0.90–0.95
    const mask2Opacity =
      progress < 0.56 ? 0
        : progress < 0.62 ? lerp(0, 1, (progress - 0.56) / 0.06)
          : progress < 0.90 ? 1
            : progress < 0.95 ? lerp(1, 0, (progress - 0.90) / 0.05)
              : 0

    // Mask Text 2 SCALE: 1→18 over 0.56–0.95
    // Reverse zoom: text readable at scale 1, scales up to 18→abstract→black
    const mask2Scale =
      progress < 0.56 ? 1
        : progress < 0.95 ? lerp(1, 18, (progress - 0.56) / 0.39)
          : 18

    // Table 2 full image
    // Fades in 0.90–0.97
    const table2Opacity =
      progress < 0.90 ? 0
        : progress < 0.97 ? lerp(0, 1, (progress - 0.90) / 0.07)
          : 1

    /* ── Apply styles ────────────────────────────────────────── */

    const s = (el: HTMLElement | null, styles: Record<string, string>) => {
      if (!el) return
      for (const [k, v] of Object.entries(styles)) {
        el.style.setProperty(k, v)
      }
    }

    // Table 1: full image, fades out at start
    s(table1ImgRef.current, {
      opacity: String(table1Opacity),
    })

    // Table 2: full image, fades in at end
    s(table2ImgRef.current, {
      opacity: String(table2Opacity),
    })

    // Mask Text 1: text-as-viewport with Table 1 image, SCALE 18→1
    s(maskText1Ref.current, {
      opacity: String(mask1Opacity),
      transform: `scale(${mask1Scale})`,
    })

    // Solid gradient text: replaces mask text at state 4
    s(solidTextRef.current, {
      opacity: String(solidOpacity),
    })

    // "or" text: green accent gradient, 0.5 opacity
    s(orTextRef.current, {
      opacity: String(orOpacity),
    })

    // "Space Eternity" text: metallic gradient, 0.5 opacity
    s(eternityTextRef.current, {
      opacity: String(eternityOpacity),
    })

    // Mask Text 2: text-as-viewport with Table 2 image, SCALE 1→18
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
      {/* Spacer: 500vh for 11 states, ~45vh per state */}
      <div ref={spacerRef} className="h-[500vh] max-md:h-[300vh]" aria-hidden="true" />

      <section
        ref={sectionRef}
        aria-label="Table showcase — Space Infinity and Space Eternity rooms"
        className="relative h-screen overflow-hidden bg-black"
        data-cms-key="section4.table-transition"
      >
        {/* ── Layer 0: Table 1 full panorama (State 1) ── */}
        <div
          ref={table1ImgRef}
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('/gallery/Space_Infinity.PNG')",
            opacity: 1,
          }}
        />

        {/* ── Layer 1: Table 2 full panorama (State 11) ── */}
        <div
          ref={table2ImgRef}
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('/gallery/Space_Enternity.PNG')",
            opacity: 0,
          }}
        />

        {/* ── Layer 2: Mask Text 1 — Table 1 image through text letterforms ──
            Starts at scale 18 (abstract texture), zooms to scale 1 (readable).
            The zoom IS the CSS transform: scale(). At 18x the letterforms are
            so large only tiny fragments of the background image are visible,
            creating an abstract texture. As scale decreases, letterforms
            become recognizable with the image visible inside them. */}
        <div
          ref={maskText1Ref}
          className={`${TEXT_CLASS} text-[clamp(3rem,12vw,9rem)] uppercase tracking-wider whitespace-nowrap`}
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

        {/* ── Layer 3: Solid gradient text — State 4 pure text stage ── */}
        <div
          ref={solidTextRef}
          className={`${TEXT_CLASS} text-[clamp(3rem,12vw,9rem)] uppercase tracking-wider whitespace-nowrap`}
          style={{
            opacity: 0,
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

        {/* ── Layer 4: "or" text — State 5, green accent gradient, 0.5 opacity ── */}
        <div
          ref={orTextRef}
          className={`${TEXT_CLASS} flex-col text-[clamp(1.8rem,5vw,4rem)] uppercase tracking-wider whitespace-nowrap`}
          style={{
            opacity: 0,
            fontFamily: FONT_FAMILY,
            backgroundImage: GRADIENT_OR,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
          data-cms-key="section4.or-text"
        >
          or
        </div>

        {/* ── Layer 5: "Space Eternity" text — State 5, metallic gradient, 0.5 opacity ── */}
        <div
          ref={eternityTextRef}
          className={`${TEXT_CLASS} flex-col text-[clamp(3rem,10vw,8rem)] uppercase tracking-wider whitespace-nowrap`}
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

        {/* ── Layer 6: Mask Text 2 — Table 2 image through text letterforms ──
            REVERSE zoom: starts at scale 1 (readable), zooms to scale 18 (abstract).
            At scale 1, full letterforms readable with Table 2 image inside.
            At scale 18, letterforms are enormous → abstract → nearly all black. */}
        <div
          ref={maskText2Ref}
          className={`${TEXT_CLASS} text-[clamp(3rem,12vw,9rem)] uppercase tracking-wider whitespace-nowrap`}
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
