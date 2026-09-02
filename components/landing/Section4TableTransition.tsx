"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Section 4 — Table 展示 (Text mask + scroll zoom)
 *
 * Apple-style texture-to-text zoom: a background image scales behind a
 * fixed text mask, transitioning from abstract texture to readable text.
 *
 * Two-layer architecture:
 *   • Background layer: image that scales 1→18 (zoom in) or 18→1 (zoom out)
 *   • Text layer: stays at scale 1, acts as mask via `background-clip: text`
 *
 * Animation phases (scroll progress 0→1):
 *   0.00–0.10  Table 1 visible, no text
 *   0.10–0.30  Zoom text fades in, background scales 18→1
 *   0.30–0.45  Pure text stage: gradient crossfades in, image fades out
 *   0.45–0.55  "OR SPACE ETERNITY" appears
 *   0.55–0.65  Gradient crossfades out, zoom text fades back in (with Table 2)
 *   0.65–0.85  Reverse zoom: background scales 1→18, zoom text fades out
 *   0.85–1.00  Table 2 visible, no text
 *
 * Placeholder images — replace with real room panoramas:
 *   Table 1: /gallery/Space_Infinity.PNG
 *   Table 2: /gallery/Space_Enternity.PNG
 */

const GRADIENT_BG =
  "linear-gradient(90deg, rgba(124,120,120,1) 2.6%, rgba(221,221,221,1) 41.4%, rgba(210,210,210,1) 62.5%, rgba(124,120,120,1) 99.9%)"

const TEXT_CLASS =
  "absolute inset-0 flex items-center justify-center select-none pointer-events-none"

export default function Section4TableTransition() {
  const sectionRef = useRef<HTMLElement>(null)
  const spacerRef = useRef<HTMLDivElement>(null)
  const bgLayer1Ref = useRef<HTMLDivElement>(null)
  const bgLayer2Ref = useRef<HTMLDivElement>(null)
  const zoomTextRef = useRef<HTMLDivElement>(null)
  const gradTextRef = useRef<HTMLDivElement>(null)
  const orTextRef = useRef<HTMLDivElement>(null)
  const inView = useRef(false)
  const rafId = useRef(0)
  const [, setTick] = useState(0)

  /* ── helpers ─────────────────────────────────────────────────── */

  const clamp = (v: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, v))

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t

  /* ── animation tick ──────────────────────────────────────────── */

  const animate = useCallback(() => {
    const spacer = spacerRef.current
    if (!spacer) return

    const rect = spacer.getBoundingClientRect()
    const vh = window.innerHeight

    // Spacer's top relative to viewport
    const spacerTop = rect.top

    // Calculate progress (0→1) through the scroll range
    // Section becomes fixed when spacerTop ≤ 0
    // Section unpins when spacer bottom reaches viewport bottom
    let progress = 0
    if (spacerTop <= 0) {
      // scrollDistance = spacerHeight - viewportHeight (the scroll range)
      const scrolled = -spacerTop
      const scrollRange = spacer.offsetHeight - vh
      progress = clamp(scrolled / Math.max(scrollRange, 1), 0, 1)
    }

    // ── Layer 1: Table 1 background (full image) ──
    const t1Opacity = progress <= 0.05 ? 1 : progress <= 0.15 ? lerp(1, 0, (progress - 0.05) / 0.1) : 0

    // ── Layer 2: Table 2 background (full image) ──
    const t2Opacity = progress >= 0.95 ? 1 : progress >= 0.85 ? lerp(0, 1, (progress - 0.85) / 0.1) : 0

    // ── Background layer 1 (for zoom text, Table 1 texture) ──
    // Visible during forward zoom (0→0.35) and reverse zoom (0.60→1.0)
    const bg1Opacity =
      progress < 0.05
        ? 0
        : progress < 0.1
          ? lerp(0, 1, (progress - 0.05) / 0.05)
          : progress < 0.3
            ? 1
            : progress < 0.4
              ? lerp(1, 0, (progress - 0.3) / 0.1)
              : 0

    // Scale: 18→1 during forward zoom (0.05→0.30)
    const bg1Scale =
      progress < 0.05
        ? 18
        : progress < 0.3
          ? lerp(18, 1, (progress - 0.05) / 0.25)
          : 1

    // ── Background layer 2 (for zoom text, Table 2 texture) ──
    // Visible during reverse zoom (0.60→0.95)
    const bg2Opacity =
      progress < 0.6
        ? 0
        : progress < 0.7
          ? lerp(0, 1, (progress - 0.6) / 0.1)
          : progress < 0.9
            ? 1
            : progress < 0.95
              ? lerp(1, 0, (progress - 0.9) / 0.05)
              : 0

    // Scale: 1→18 during reverse zoom (0.65→0.90)
    const bg2Scale =
      progress < 0.65
        ? 1
        : progress < 0.9
          ? lerp(1, 18, (progress - 0.65) / 0.25)
          : 18

    // ── Zoom text (text mask, stays at scale 1) ──
    // Visible: 0.05–0.40 (forward) and 0.60–0.90 (reverse)
    const zoomOpacity =
      progress < 0.05
        ? 0
        : progress < 0.12
          ? lerp(0, 1, (progress - 0.05) / 0.07)
          : progress < 0.3
            ? 1
            : progress < 0.4
              ? lerp(1, 0, (progress - 0.3) / 0.1)
              : progress < 0.6
                ? 0
                : progress < 0.68
                  ? lerp(0, 1, (progress - 0.6) / 0.08)
                  : progress < 0.82
                    ? 1
                    : progress < 0.92
                      ? lerp(1, 0, (progress - 0.82) / 0.1)
                      : 0

    // ── Gradient text (pure color stage) ──
    // Visible: 0.30–0.70
    const gradOpacity =
      progress < 0.3
        ? 0
        : progress < 0.4
          ? lerp(0, 1, (progress - 0.3) / 0.1)
          : progress < 0.58
            ? 1
            : progress < 0.68
              ? lerp(1, 0, (progress - 0.58) / 0.1)
              : 0

    // ── OR text ──
    // Visible: 0.42–0.60
    const orOpacity =
      progress < 0.42
        ? 0
        : progress < 0.5
          ? lerp(0, 1, (progress - 0.42) / 0.08)
          : progress < 0.52
            ? 1
            : progress < 0.6
              ? lerp(1, 0, (progress - 0.52) / 0.08)
              : 0

    // ── Apply styles ──
    const s = (el: HTMLElement | null, styles: Record<string, string>) => {
      if (!el) return
      for (const [k, v] of Object.entries(styles)) {
        el.style.setProperty(k, v)
      }
    }

    // Table 1
    s(bgLayer1Ref.current, {
      opacity: String(t1Opacity),
      transform: `scale(${bg1Scale})`,
    })

    // Table 2
    s(bgLayer2Ref.current, {
      opacity: String(t2Opacity),
      transform: `scale(${bg2Scale})`,
    })

    // Zoom text
    s(zoomTextRef.current, {
      opacity: String(zoomOpacity),
      backgroundImage:
        bg1Opacity > bg2Opacity
          ? "url('/gallery/Space_Infinity.PNG')"
          : "url('/gallery/Space_Enternity.PNG')",
    })

    // Gradient text
    s(gradTextRef.current, { opacity: String(gradOpacity) })

    // OR text
    s(orTextRef.current, { opacity: String(orOpacity) })

    // Schedule next frame
    rafId.current = requestAnimationFrame(animate)
  }, [])

  /* ── scroll observer ─────────────────────────────────────────── */

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
          setTick((t) => t + 1) // force final state render
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
      {/* Spacer: creates the scroll distance for the pinned animation.
          Desktop: 4x viewport height; Mobile: 2.5x via Tailwind. */}
      <div ref={spacerRef} className="h-[400vh] max-md:h-[250vh]" aria-hidden="true" />

      <section
        ref={sectionRef}
        aria-label="Table showcase — Space Infinity and Space Eternity rooms"
        className="relative h-screen overflow-hidden bg-black"
        data-cms-key="section4.table-transition"
      >
        {/* ── Table 1: Full image ── */}
        <img
          src="/gallery/Space_Infinity.PNG"
          alt="Space Infinity room"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: 1 }}
        />

        {/* ── Table 2: Full image ── */}
        <img
          src="/gallery/Space_Enternity.PNG"
          alt="Space Eternity room"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: 0 }}
        />

        {/* ── Background layer 1: Scales behind zoom text (Table 1 texture) ── */}
        <div
          ref={bgLayer1Ref}
          className="absolute inset-0 overflow-hidden"
          style={{
            opacity: 0,
            transform: "scale(18)",
            transformOrigin: "center center",
          }}
        >
          <img
            src="/gallery/Space_Infinity.PNG"
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
          />
        </div>

        {/* ── Background layer 2: Scales behind zoom text (Table 2 texture) ── */}
        <div
          ref={bgLayer2Ref}
          className="absolute inset-0 overflow-hidden"
          style={{
            opacity: 0,
            transform: "scale(1)",
            transformOrigin: "center center",
          }}
        >
          <img
            src="/gallery/Space_Enternity.PNG"
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
          />
        </div>

        {/* ── Zoom text: background-clip text mask, stays at scale 1 ── */}
        <div
          ref={zoomTextRef}
          className={`${TEXT_CLASS} font-good-times text-[clamp(3rem,12vw,9rem)] uppercase tracking-wider`}
          style={{
            opacity: 0,
            backgroundSize: "cover",
            backgroundPosition: "center",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            backgroundImage: "url('/gallery/Space_Infinity.PNG')",
          }}
          data-cms-key="section4.space-infinity"
        >
          Space Infinity
        </div>

        {/* ── Gradient text: pure metallic gradient (no image) ── */}
        <div
          ref={gradTextRef}
          className={`${TEXT_CLASS} flex-col gap-2 font-good-times text-[clamp(3rem,12vw,9rem)] uppercase tracking-wider`}
          style={{
            opacity: 0,
            backgroundImage: GRADIENT_BG,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
          data-cms-key="section4.space-infinity-gradient"
        >
          <span>Space Infinity</span>
        </div>

        {/* ── OR text ── */}
        <div
          ref={orTextRef}
          className={`${TEXT_CLASS} flex-col gap-2 font-good-times text-[clamp(1.8rem,5vw,4rem)] uppercase tracking-wider`}
          style={{
            opacity: 0,
            backgroundImage: GRADIENT_BG,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
          data-cms-key="section4.or-space-eternity"
        >
          <span>or</span>
          <span className="text-[clamp(3rem,10vw,8rem)]">Space Eternity</span>
        </div>
      </section>
    </>
  )
}
