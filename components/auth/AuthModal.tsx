"use client"

import { useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { useTranslations } from "next-intl"
import { AuthCard } from "./AuthCard"
import { Logo } from "@/components/brand"

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
  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  // Lock body scroll while open and place focus inside the dialog. The parent
  // trigger is restored on close when it is still connected to the document.
  useEffect(() => {
    if (!open) return
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus())
    return () => {
      window.cancelAnimationFrame(frame)
      document.body.style.overflow = prev
      triggerRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open || !dismissible) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [dismissible, onClose, open])

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
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
            initial={{ scale: 0.94, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 16 }}
            transition={{ type: "spring", damping: 24, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel"
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 400,
              maxHeight: "calc(100dvh - 40px)",
              overflowY: "auto",
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

            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                <Logo variant="full" theme="dark" size={40} />
              </div>
              <h1 id="auth-modal-title" data-cms-key="auth.title" style={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: 32, letterSpacing: "0.02em", color: "#fff", margin: 0 }}>
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
