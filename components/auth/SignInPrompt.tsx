"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { useTranslations } from "next-intl"
import { useAuthSession } from "@/lib/auth/useAuthSession"

const GREEN = "#22c55e"
// Dark-glass pill matching the landing nav's blur+saturate treatment.
const GLASS_BG = "rgba(12,12,14,0.82)"
const GLASS_BLUR = "blur(20px) saturate(180%)"
const DISMISS_KEY = "signin_prompt_dismissed"
const SHOW_DELAY_MS = 2500

// Subtle, non-blocking "sign in for faster booking" prompt for ANONYMOUS visitors
// on marketing pages (Nav renders this; Nav isn't on /book, /login, or /member).
// Never a wall: anonymous browsing stays free (the agreed silent-if-logged-in
// model). Shows once, after a short delay, and stays dismissed via localStorage.
// Uses useAuthSession so it never flashes for a logged-in user (waits for the
// session check to resolve). Portaled to <body> so the nav's scroll-time
// transform: scale() doesn't trap the fixed element.
export function SignInPrompt({ onOpenLogin }: { onOpenLogin: () => void }) {
  const t = useTranslations("nav")
  const { loading, user } = useAuthSession()
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(true) // assume dismissed until checked

  useEffect(() => setMounted(true), [])

  // Read the one-time dismissal flag once on mount.
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1")
    } catch {
      setDismissed(false)
    }
  }, [])

  // Reveal only when: session resolved + anonymous + not previously dismissed.
  useEffect(() => {
    if (loading || user || dismissed) {
      setVisible(false)
      return
    }
    const id = setTimeout(() => setVisible(true), SHOW_DELAY_MS)
    return () => clearTimeout(id)
  }, [loading, user, dismissed])

  const close = () => {
    setVisible(false)
    try {
      localStorage.setItem(DISMISS_KEY, "1")
    } catch {
      /* ignore */
    }
  }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: "spring", damping: 26, stiffness: 320 }}
          style={{
            position: "fixed",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: 20,
            zIndex: 90,
            display: "flex",
            alignItems: "center",
            gap: 14,
            maxWidth: "calc(100vw - 32px)",
            padding: "12px 14px 12px 18px",
            background: GLASS_BG,
            backdropFilter: GLASS_BLUR,
            WebkitBackdropFilter: GLASS_BLUR,
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 9999,
            boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
          }}
          role="status"
        >
          <span data-cms-key="nav.prompt_text" style={{ fontSize: 14, color: "#fff", whiteSpace: "nowrap" }}>
            {t("prompt_text")}
          </span>
          <button
            type="button"
            onClick={() => {
              close()
              onOpenLogin()
            }}
            data-cms-key="nav.prompt_cta"
            style={{
              flexShrink: 0,
              padding: "7px 16px",
              borderRadius: 9999,
              background: GREEN,
              color: "#000",
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            {t("prompt_cta")}
          </button>
          <button
            type="button"
            onClick={close}
            aria-label={t("prompt_dismiss")}
            style={{ flexShrink: 0, background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", padding: 4 }}
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
