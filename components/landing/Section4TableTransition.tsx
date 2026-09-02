"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Section 4 — Table 展示 (Simplified CSS crossfade)
 *
 * Two static images with a one-time IntersectionObserver-triggered crossfade.
 * Table 1 (Space Infinity) starts fully visible; when the section scrolls into
 * view (30% threshold), a 1.5s CSS transition crossfades to Table 2 (Space
 * Eternity) with text overlay.
 *
 * Placeholder images — replace with real room panoramas when available:
 *   Table 1: /gallery/S2/part3_table_wide_room.png
 *   Table 2: /gallery/Space_Enternity.PNG
 */

const GOOD_TIMES: React.CSSProperties = {
  fontFamily: '"Good Times", "Bebas Neue", sans-serif',
}

export default function Section4TableTransition() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const triggered = useRef(false)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !triggered.current) {
          triggered.current = true
          setInView(true)
        }
      },
      { threshold: 0.3 },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      aria-label="Table showcase — Space Infinity and Space Eternity rooms"
      className="relative h-screen overflow-hidden bg-black"
    >
      {/* Table 1 — starts fully visible, fades out on trigger */}
      {/* TODO: Replace with real Table 1 panorama photo */}
      <img
        src="/gallery/S2/part3_table_wide_room.png"
        alt="Space Infinity room"
        className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[1500ms]"
        style={{ opacity: inView ? 0 : 1 }}
      />

      {/* Table 2 — starts hidden, fades in on trigger */}
      {/* TODO: Replace with real Table 2 panorama photo */}
      <img
        src="/gallery/Space_Enternity.PNG"
        alt="Space Eternity room"
        className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[1500ms]"
        style={{ opacity: inView ? 1 : 0 }}
      />

      {/* Dark scrim for text readability */}
      <div
        className="absolute inset-0 bg-black transition-opacity duration-[1500ms]"
        style={{ opacity: inView ? 0.4 : 0 }}
      />

      {/* Text overlay */}
      <div
        className="relative z-10 text-center transition-opacity duration-[1500ms]"
        style={{ opacity: inView ? 1 : 0 }}
      >
        <h2
          className="text-6xl font-bold text-white md:text-8xl"
          style={GOOD_TIMES}
          data-cms-key="section4.title"
        >
          Space Infinity
        </h2>
        <h3
          className="mt-4 text-3xl text-white/80 md:text-5xl"
          style={GOOD_TIMES}
          data-cms-key="section4.subtitle"
        >
          or Space Eternity
        </h3>
      </div>
    </section>
  )
}
