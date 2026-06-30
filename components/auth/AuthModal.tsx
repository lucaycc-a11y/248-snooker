"use client"

import { useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { useTranslations } from "next-intl"
import { AuthCard } from "./AuthCard"

const GREEN = "#22c55e"

// Modal wrapper around the shared AuthCard, used by in-app entry points (e.g. the
// booking flow). The /login PAGE renders AuthCard directly inside its own layout.
// Deep-green surface + single brass hairline (no glow/shadow) per the elevated
// "members' club" direction. While the profile gate is active the modal cannot be
// dismissed — the parent controls `dismissible`.
export function AuthModal({
  open,
  returnUrl,
  onAuthComplete,
  onClose,
  dismissible = true,
}: {
  open: boolean
  returnUrl: string
  onAuthComplete: () => void
  onClose: () => void
  dismissible?: boolean
}) {
  const t = useTranslations("auth")

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={() => dismissible && onClose()}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 120,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 16 }}
            transition={{ type: "spring", damping: 24, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 400,
              background: "rgba(255,255,255,0.05)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 24,
              padding: 40,
            }}
          >
            {dismissible && (
              <button
                type="button"
                onClick={onClose}
                aria-label={t("close")}
                style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            )}

            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div data-cms-key="auth.brand" style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.32em", color: GREEN, marginBottom: 12 }}>
                248 SNOOKER
              </div>
              <h1 data-cms-key="auth.title" style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 34, letterSpacing: "0.02em", color: "#fff" }}>
                {t("title")}
              </h1>
            </div>

            <AuthCard returnUrl={returnUrl} onAuthComplete={onAuthComplete} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
