"use client"

import Image from "next/image"
import { motion, useReducedMotion } from "framer-motion"
import { useEffect, useRef, useState } from "react"

// Screenshot real dimensions: 4269 × 2400 → aspect ratio 1.7788
const SCREEN_IMAGE = "/gallery/spacepliot.png"
const EASE: [number, number, number, number] = [0.2, 0.7, 0.3, 1]

type Props = { compact?: boolean }

export default function SpacePilotScoreboardExperience({ compact = false }: Props) {
  const reducedMotion = useReducedMotion()
  const sectionRef = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold: 0.12 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const show = reducedMotion ? true : visible

  return (
    <section
      ref={sectionRef}
      aria-labelledby="space-pilot-section-title"
      data-nav-theme="dark"
      style={{
        background: "#000",
        color: "#fff",
        minHeight: "100svh",
        display: "flex",
        alignItems: "center",
        padding: "80px 20px",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto", width: "100%" }}>

        {/* Eyebrow */}
        <motion.p
          data-cms-key="spacePilot.section_eyebrow"
          initial={{ opacity: 0, y: 12 }}
          animate={show ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.65, ease: EASE, delay: 0 }}
          style={{
            textAlign: "center",
            fontSize: "clamp(15px, 1.1vw, 17px)",
            color: "rgba(255,255,255,0.45)",
            letterSpacing: "0.06em",
            margin: "0 0 20px",
            fontWeight: 400,
          }}
        >
          Space Pilot
        </motion.p>

        {/* Headline */}
        <motion.h2
          id="space-pilot-section-title"
          data-cms-key="spacePilot.section_headline"
          initial={{ opacity: 0, y: 16 }}
          animate={show ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
          style={{
            textAlign: "center",
            fontSize: "clamp(2.25rem, 5vw, 4.5rem)",
            lineHeight: 1.1,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            margin: "0 0 56px",
          }}
        >
          每一場對戰，<br />都值得被記錄。
        </motion.h2>

        {/* iPad frame */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={show ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.75, ease: EASE, delay: 0.18 }}
          style={{
            /* outer bezel */
            margin: "0 auto",
            width: "min(78%, 1100px)",
            borderRadius: 28,
            border: "2px solid rgba(255,255,255,0.18)",
            background: "#0a0a0a",
            padding: 10,
          }}
        >
          {/* screen well — aspect matches the real screenshot */}
          <div
            style={{
              borderRadius: 18,
              overflow: "hidden",
              position: "relative",
              aspectRatio: "4269 / 2400",
            }}
          >
            <Image
              src={SCREEN_IMAGE}
              alt="Space Pilot 計分介面展示"
              fill
              sizes="(max-width: 768px) 95vw, min(78vw, 1100px)"
              className="object-cover"
              priority
              draggable={false}
            />
          </div>
        </motion.div>

        {/* Bottom two-column row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={show ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: EASE, delay: 0.3 }}
          style={{
            margin: "80px auto 0",
            maxWidth: 960,
            display: "grid",
            gridTemplateColumns: "1fr 2fr",
            gap: "40px 56px",
            alignItems: "start",
          }}
          className="space-pilot-bottom-row"
        >
          {/* Left: stat block */}
          <div>
            <p
              data-cms-key="spacePilot.stat_label"
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.4)",
                letterSpacing: "0.06em",
                margin: "0 0 10px",
                textTransform: "uppercase",
              }}
            >
              Space Pilot 智能管家
            </p>
            <p
              data-cms-key="spacePilot.stat_main"
              style={{
                fontSize: "clamp(1.5rem, 2.4vw, 2.25rem)",
                fontWeight: 600,
                lineHeight: 1.15,
                margin: "0 0 10px",
                letterSpacing: "-0.015em",
              }}
            >
              敬請期待
            </p>
            <p
              data-cms-key="spacePilot.stat_footnote"
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.38)",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              功能開發中，詳情將於日後公佈
            </p>
          </div>

          {/* Right: paragraph */}
          <p
            data-cms-key="spacePilot.section_body"
            style={{
              fontSize: "clamp(17px, 1.35vw, 21px)",
              lineHeight: 1.65,
              color: "rgba(255,255,255,0.58)",
              margin: 0,
            }}
          >
            Space Pilot 將協助你
            <strong style={{ color: "#fff", fontWeight: 600 }}>記錄每一場對戰</strong>
            。透過 iPad 即時
            <strong style={{ color: "#fff", fontWeight: 600 }}>計分</strong>
            ，每一局的比分與勝負都會自動整理，讓你隨時回顧，並將每一場對戰變成
            <strong style={{ color: "#fff", fontWeight: 600 }}>可追蹤的練習紀錄</strong>
            。
          </p>
        </motion.div>
      </div>

      {/* Mobile stacking: stat block appears above body paragraph on small screens */}
      <style>{`
        @media (max-width: 640px) {
          .space-pilot-bottom-row {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  )
}
