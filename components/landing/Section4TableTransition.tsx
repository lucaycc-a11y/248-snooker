"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Section 4 — Table 展示 (Canvas Image-Sequence Scrubbing)
 *
 * V1 placeholder: 120 frames rendered programmatically via Canvas API.
 *   Frames  0–29  : Table 1 (Space Infinity) sharp
 *   Frames 30–59  : Table 1 blurs + darkens + "Space Infinity" text appears
 *   Frames 60–79  : "or Space Eternity" fades in below
 *   Frames 80–119 : Text fades out, Table 2 (Space Eternity) fades in
 *
 * Swap in hand-crafted frame sequences (WebP @ 1920×1080) by replacing the
 * `generateFrames` function with a loader that reads from `/section4-frames/`.
 *
 * Uses `position: sticky` (not GSAP ScrollTrigger — see Section2Value.tsx
 * comment for why: mobile Safari pin-spacing / address-bar resize bugs).
 *
 * Placeholder images — replace with real room photos when available:
 *   Table 1: /gallery/S2/part3_table_wide_room.png
 *   Table 2: /gallery/Space_Enternity.PNG
 */

const FRAME_COUNT = 120
const CW = 1920
const CH = 1080

/* ─── helpers ─────────────────────────────────────────────────────────── */

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function smoothstep(x: number, a: number, b: number, c: number, d: number): number {
  if (x <= a) return 0
  if (x >= d) return 0
  if (x >= b && x <= c) return 1
  if (x < b) return (x - a) / (b - a)
  return (d - x) / (d - c)
}

/** Draw an image to cover a canvas (object-fit: cover behaviour). */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cw: number,
  ch: number,
): void {
  const ratio = Math.max(cw / img.width, ch / img.height)
  const w = img.width * ratio
  const h = img.height * ratio
  ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h)
}

/* ─── frame generation ────────────────────────────────────────────────── */

function renderFrame(
  ctx: CanvasRenderingContext2D,
  index: number,
  t1: HTMLImageElement,
  t2: HTMLImageElement,
): void {
  const p = index / (FRAME_COUNT - 1)

  // Per-channel animation curves
  const t1Opacity = smoothstep(p, 0.0, 0.0, 0.62, 0.78)
  const t2Opacity = smoothstep(p, 0.72, 0.85, 1.0, 1.0)
  const scrim = smoothstep(p, 0.22, 0.35, 0.68, 0.80) * 0.6
  const titleOp = smoothstep(p, 0.25, 0.35, 0.68, 0.78)
  const subOp = smoothstep(p, 0.48, 0.58, 0.68, 0.78)

  // Layer 0 — Table 1 (sharp)
  ctx.globalAlpha = t1Opacity
  ctx.globalCompositeOperation = "source-over"
  drawCover(ctx, t1, CW, CH)

  // Layer 2 — Table 2 (sharp, fading in)
  ctx.globalAlpha = t2Opacity
  drawCover(ctx, t2, CW, CH)

  // Layer 3 — dark scrim for text readability
  ctx.globalAlpha = scrim
  ctx.fillStyle = "#000"
  ctx.fillRect(0, 0, CW, CH)

  // Layer 4 — text overlays
  ctx.globalAlpha = 1
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"

  // "Space Infinity"
  ctx.globalAlpha = titleOp
  ctx.fillStyle = "#fff"
  ctx.font = '800 120px "Good Times", "Bebas Neue", sans-serif'
  ctx.letterSpacing = "12px"
  ctx.fillText("Space Infinity", CW / 2, CH / 2 - 40)
  ctx.letterSpacing = "0px"

  // "or Space Eternity"
  ctx.globalAlpha = subOp
  ctx.fillStyle = "rgba(255,255,255,0.7)"
  ctx.font = '400 52px "Good Times", "Bebas Neue", sans-serif'
  ctx.letterSpacing = "8px"
  ctx.fillText("or Space Eternity", CW / 2, CH / 2 + 60)
  ctx.letterSpacing = "0px"

  // Reset
  ctx.globalAlpha = 1
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load: ${src}`))
    img.src = src
  })
}

/* ─── component ───────────────────────────────────────────────────────── */

export default function Section4TableTransition() {
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const framesRef = useRef<HTMLCanvasElement[]>([])
  const currentFrame = useRef(-1)
  const ticking = useRef(false)
  const [loaded, setLoaded] = useState(false)

  // 1. Load source images, pre-render all frames to offscreen canvases
  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const [t1, t2] = await Promise.all([
          loadImg("/gallery/S2/part3_table_wide_room.png"),
          loadImg("/gallery/Space_Enternity.PNG"),
        ])
        if (cancelled) return

        // Pre-render every frame to its own offscreen canvas
        const frames: HTMLCanvasElement[] = []
        for (let i = 0; i < FRAME_COUNT; i++) {
          const c = document.createElement("canvas")
          c.width = CW
          c.height = CH
          const ctx = c.getContext("2d")
          if (ctx) renderFrame(ctx, i, t1, t2)
          frames.push(c)
        }
        framesRef.current = frames

        // Draw first frame immediately
        const mainCanvas = canvasRef.current
        if (mainCanvas) {
          const ctx = mainCanvas.getContext("2d")
          if (ctx && frames[0]) {
            ctx.drawImage(frames[0], 0, 0, mainCanvas.width, mainCanvas.height)
          }
        }
        currentFrame.current = 0
        setLoaded(true)
      } catch (err) {
        console.error("[Section4] frame generation failed:", err)
        setLoaded(true) // still mark loaded so scroll works (shows black)
      }
    })()

    return () => { cancelled = true }
  }, [])

  // 2. Scroll → frame scrubbing
  useEffect(() => {
    if (!loaded) return

    const stage = stageRef.current
    if (!stage) return

    const draw = (index: number): void => {
      const canvas = canvasRef.current
      const frame = framesRef.current[index]
      if (!canvas || !frame) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(frame, 0, 0, canvas.width, canvas.height)
    }

    const update = (): void => {
      ticking.current = false
      const rect = stage.getBoundingClientRect()
      const total = stage.offsetHeight - window.innerHeight
      if (total <= 0) return

      const scrolled = clamp01(-rect.top / total)
      const idx = Math.min(FRAME_COUNT - 1, Math.floor(scrolled * FRAME_COUNT))

      if (idx !== currentFrame.current) {
        currentFrame.current = idx
        draw(idx)
      }
    }

    const onScroll = (): void => {
      if (!ticking.current) {
        ticking.current = true
        requestAnimationFrame(update)
      }
    }

    // Resize canvas to match CSS layout size
    const resize = (): void => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = canvas.clientWidth * devicePixelRatio
      canvas.height = canvas.clientHeight * devicePixelRatio
      // Re-draw current frame at new resolution
      if (currentFrame.current >= 0) draw(currentFrame.current)
    }

    resize()
    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", resize, { passive: true })

    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", resize)
    }
  }, [loaded])

  return (
    <section
      aria-label="Table showcase — Space Infinity and Space Eternity rooms"
      className="relative bg-black"
      style={{ height: "400vh" }}
    >
      <div
        ref={stageRef}
        className="sticky top-0 h-screen w-full overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          className="h-full w-full object-cover"
          aria-hidden="true"
        />

        {/* Loading overlay — visible until all frames are pre-rendered */}
        {!loaded && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black text-white">
            <span className="font-label text-lg tracking-[0.12em] text-white/60"
              style={{ fontFamily: '"Good Times", "Bebas Neue", sans-serif' }}
            >
              Loading…
            </span>
          </div>
        )}
      </div>
    </section>
  )
}
