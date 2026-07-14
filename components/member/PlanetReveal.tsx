"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Download, ArrowRight } from "lucide-react"
import { type PlanetName, PLANET_METADATA } from "@/lib/member/planetSystem"
import { Planet3D } from "./Planet3D"

const GREEN = "#22c55e"
const EASE = [0.16, 1, 0.3, 1] as const

type Phase = "loading" | "reveal" | "complete"

// Starfield background
function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = window.innerWidth * dpr
    canvas.height = window.innerHeight * dpr
    canvas.style.width = `${window.innerWidth}px`
    canvas.style.height = `${window.innerHeight}px`
    ctx.scale(dpr, dpr)

    // Generate 200 stars
    const stars: { x: number; y: number; size: number; opacity: number }[] = []
    for (let i = 0; i < 200; i++) {
      stars.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.5 + 0.3,
      })
    }

    let frame = 0
    const animate = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

      stars.forEach((star, i) => {
        const twinkle = Math.sin(frame * 0.02 + i) * 0.3
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity + twinkle})`
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
        ctx.fill()
      })

      frame++
      requestAnimationFrame(animate)
    }

    animate()
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    />
  )
}

export function PlanetReveal({
  planetName,
  memberCode,
  onComplete,
  onShare,
  labels,
}: {
  planetName: PlanetName
  memberCode: string
  onComplete: () => void
  onShare?: () => void
  labels: {
    loading: string
    welcome_prefix: string
    welcome_suffix: string
    subtitle: string
    share_button: string
    continue_button: string
  }
}) {
  const [phase, setPhase] = useState<Phase>("loading")
  const meta = PLANET_METADATA[planetName]

  useEffect(() => {
    // Phase transitions
    const timer1 = setTimeout(() => setPhase("reveal"), 1500)
    const timer2 = setTimeout(() => setPhase("complete"), 2500)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [])

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
        zIndex: 9999,
      }}
    >
      <StarField />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          maxWidth: 600,
          padding: "0 24px",
        }}
      >
        <AnimatePresence mode="wait">
          {phase === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div
                style={{
                  width: 200,
                  height: 200,
                  margin: "0 auto 32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    background: `radial-gradient(circle, ${GREEN}40 0%, ${GREEN}20 50%, ${GREEN}00 100%)`,
                    animation: "pulse 1.5s ease-in-out infinite",
                  }}
                />
              </div>
              <p
                style={{
                  fontSize: 18,
                  color: "rgba(255,255,255,0.7)",
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              >
                {labels.loading}
              </p>
            </motion.div>
          )}

          {phase === "reveal" && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, ease: EASE }}
            >
              <div
                style={{
                  filter: "drop-shadow(0 0 40px rgba(34, 197, 94, 0.3))",
                }}
              >
                <Planet3D planetName={planetName} phase={phase} width={400} height={400} />
              </div>
            </motion.div>
          )}

          {phase === "complete" && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: EASE }}
            >
              <div
                style={{
                  filter: "drop-shadow(0 0 40px rgba(34, 197, 94, 0.2))",
                }}
              >
                <Planet3D planetName={planetName} phase={phase} width={300} height={300} />
              </div>

              <h1
                style={{
                  fontFamily: '"Bebas Neue", sans-serif',
                  fontSize: "clamp(32px, 8vw, 56px)",
                  fontWeight: 400,
                  letterSpacing: "0.05em",
                  margin: "0 0 12px",
                  color: "#fff",
                }}
              >
                {labels.welcome_prefix}
                <span style={{ color: GREEN, margin: "0 8px" }}>
                  {meta.displayName}
                </span>
                {labels.welcome_suffix}
              </h1>

              <p
                style={{
                  fontSize: 16,
                  color: "rgba(255,255,255,0.6)",
                  marginBottom: 24,
                }}
              >
                {labels.subtitle}
              </p>

              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 20,
                  fontWeight: 600,
                  color: GREEN,
                  marginBottom: 48,
                  letterSpacing: "0.05em",
                }}
              >
                {memberCode}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                {onShare && (
                  <button
                    onClick={onShare}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "14px 28px",
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      borderRadius: 12,
                      color: "#fff",
                      fontSize: 16,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.12)"
                      e.currentTarget.style.transform = "translateY(-2px)"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(255,255,255,0.08)"
                      e.currentTarget.style.transform = "translateY(0)"
                    }}
                  >
                    <Download size={18} />
                    {labels.share_button}
                  </button>
                )}

                <button
                  onClick={onComplete}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "14px 32px",
                    background: GREEN,
                    border: "none",
                    borderRadius: 12,
                    color: "#000",
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "scale(1.05)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1)"
                  }}
                >
                  {labels.continue_button}
                  <ArrowRight size={18} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
