"use client"

import { useEffect, useRef } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger)
}

const SECTION4_CONFIG = {
  designWidth: 1512,
  designHeight: 1123,
  font: {
    family: "'Good Times', sans-serif",
    weight: 400,
    sizeAtDesignWidth: 128,
  },
  metallicGradient:
    "linear-gradient(90.128deg, rgb(124, 120, 120) 2.6068%, rgb(221, 221, 221) 41.449%, rgb(210, 210, 210) 62.509%, rgb(124, 120, 120) 99.947%)",
  orGradient:
    "linear-gradient(90.128deg, rgba(124, 120, 120, 1) 2.6068%, rgba(57, 255, 43, 0) 9.5794%, rgba(124, 120, 120, 1) 18.65%, rgba(221, 221, 221, 1) 39.998%, rgba(210, 210, 210, 1) 62.509%)",
  part2ZoomStart: 198,
  part2ZoomEnd: 1,
  part4ZoomStart: 1,
  part4ZoomEnd: 794,
} as const

const FONT_STYLE = {
  fontFamily: SECTION4_CONFIG.font.family,
  fontWeight: SECTION4_CONFIG.font.weight,
  fontSize: "clamp(2.5rem, 8.4656vw, 8rem)",
  lineHeight: "normal",
  letterSpacing: "normal",
  textTransform: "uppercase" as const,
}

const getMask = (text: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SECTION4_CONFIG.designWidth} ${SECTION4_CONFIG.designHeight}"><rect width="100%" height="100%" fill="white"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="Good Times" font-size="128" font-weight="400" fill="black">${text}</text></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

export default function Section4TableTransition() {
  const stageRef = useRef<HTMLElement>(null)
  const infinityMaskRef = useRef<HTMLDivElement>(null)
  const eternityMaskRef = useRef<HTMLDivElement>(null)
  const table1Ref = useRef<HTMLDivElement>(null)
  const table2Ref = useRef<HTMLDivElement>(null)
  const infinityTextRef = useRef<HTMLDivElement>(null)
  const orTextRef = useRef<HTMLDivElement>(null)
  const eternityTextRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const ctx = gsap.context(() => {
      const setState = (progress: number) => {
        const part2 = gsap.utils.clamp(0, 1, (progress - 0.08) / 0.22)
        const part3 = gsap.utils.clamp(0, 1, (progress - 0.30) / 0.12)
        const part4 = gsap.utils.clamp(0, 1, (progress - 0.46) / 0.24)
        const part5 = gsap.utils.clamp(0, 1, (progress - 0.70) / 0.16)

        gsap.set(infinityMaskRef.current, {
          scale: SECTION4_CONFIG.part2ZoomStart + (SECTION4_CONFIG.part2ZoomEnd - SECTION4_CONFIG.part2ZoomStart) * part2,
          opacity: part2 * (1 - part3),
        })
        gsap.set(table1Ref.current, { opacity: 1 - part5 })
        gsap.set(infinityTextRef.current, { opacity: 1 - part3, yPercent: -part4 * 20 })
        gsap.set(orTextRef.current, { opacity: part4 })
        gsap.set(eternityTextRef.current, { opacity: part4 * (1 - part5), yPercent: -part4 * 20 })
        gsap.set(eternityMaskRef.current, {
          scale: SECTION4_CONFIG.part4ZoomStart + (SECTION4_CONFIG.part4ZoomEnd - SECTION4_CONFIG.part4ZoomStart) * part5,
          opacity: part5,
        })
        gsap.set(table2Ref.current, { opacity: part5 })
      }

      const trigger = ScrollTrigger.create({
        trigger: stage,
        start: "top top",
        end: "bottom bottom",
        scrub: 1,
        onUpdate: (self) => setState(self.progress),
      })

      setState(0)
      return () => trigger.kill()
    }, stage)

    return () => ctx.revert()
  }, [])

  return (
    <section
      ref={stageRef}
      aria-label="Table showcase: Space Infinity and Space Eternity rooms"
      data-cms-key="section4.table-transition"
      className="s4-stage"
    >
      <div className="s4-viewport">
        <div ref={table1Ref} className="s4-image" style={{ backgroundImage: "url('/gallery/Space_Infinity.PNG')" }} />
        <div ref={table2Ref} className="s4-image" style={{ backgroundImage: "url('/gallery/Space_Enternity.PNG')", opacity: 0 }} />

        <div
          ref={infinityMaskRef}
          className="s4-mask"
          style={{
            backgroundColor: "#000",
            maskImage: getMask("SPACE INFINITY"),
            WebkitMaskImage: getMask("SPACE INFINITY"),
          }}
        />

        <div className="s4-copy s4-copy-single">
          <div ref={infinityTextRef} className="s4-title" data-cms-key="section4.space-infinity-gradient" style={{ ...FONT_STYLE, backgroundImage: SECTION4_CONFIG.metallicGradient }}>Space Infinity</div>
        </div>

        <div className="s4-copy s4-copy-double">
          <div ref={orTextRef} className="s4-or" data-cms-key="section4.or-text" style={{ ...FONT_STYLE, backgroundImage: SECTION4_CONFIG.orGradient }}>or</div>
          <div ref={eternityTextRef} className="s4-title" data-cms-key="section4.space-eternity" style={{ ...FONT_STYLE, backgroundImage: SECTION4_CONFIG.metallicGradient }}>Space Eternity</div>
        </div>

        <div
          ref={eternityMaskRef}
          className="s4-mask"
          style={{
            backgroundColor: "#000",
            maskImage: getMask("SPACE ETERNITY"),
            WebkitMaskImage: getMask("SPACE ETERNITY"),
            opacity: 0,
          }}
        />
      </div>
      <style jsx>{`
        .s4-stage { position: relative; height: 500svh; background: #000; }
        .s4-viewport { position: sticky; top: 0; height: 100svh; overflow: hidden; background: #000; }
        .s4-image, .s4-mask { position: absolute; inset: 0; background-position: center; background-size: cover; }
        .s4-mask { background-color: #000; mask-repeat: no-repeat; mask-position: center; mask-size: 100% 100%; -webkit-mask-repeat: no-repeat; -webkit-mask-position: center; -webkit-mask-size: 100% 100%; transform-origin: 50% 50%; }
        .s4-copy { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; user-select: none; }
        .s4-copy-double { flex-direction: column; gap: 0; }
        .s4-title, .s4-or { display: inline-block; color: transparent; background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-align: center; white-space: nowrap; }
        .s4-title { width: min(85.4vw, 1291px); }
        .s4-or { width: min(80.9vw, 1223px); font-size: clamp(1.75rem, 5.2vw, 5rem); }
        @media (prefers-reduced-motion: reduce) { .s4-stage { height: 100svh; } .s4-viewport { position: relative; } .s4-mask, .s4-copy-double { display: none; } }
        @media (max-width: 768px) { .s4-stage { height: 360svh; } .s4-title { width: 94vw; } .s4-or { width: 88vw; } }
      `}</style>
    </section>
  )
}
