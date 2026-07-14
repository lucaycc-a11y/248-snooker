'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { tokens } from '@/app/styles/tokens'

type SheetProps = {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

export function Sheet({ open, onClose, children }: SheetProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const isMobile = typeof window !== 'undefined' && window.innerWidth < tokens.breakpoint.mobile

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.6)',
              zIndex: 100,
            }}
          />
          {/* Sheet / Modal */}
          <motion.div
            initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95 }}
            animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1 }}
            exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95 }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 300,
            }}
            style={{
              position: 'fixed',
              zIndex: 101,
              backgroundColor: tokens.colors.surfaceElevated,
              border: `1px solid ${tokens.colors.border}`,
              overflow: 'auto',
              ...(isMobile
                ? {
                    bottom: 0,
                    left: 0,
                    right: 0,
                    borderTopLeftRadius: tokens.radius.card,
                    borderTopRightRadius: tokens.radius.card,
                    maxHeight: '85vh',
                  }
                : {
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    borderRadius: tokens.radius.card,
                    maxWidth: '420px',
                    width: '90%',
                    maxHeight: '80vh',
                  }),
            }}
          >
            {/* Drag handle (mobile) */}
            {isMobile && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  paddingTop: '12px',
                  paddingBottom: '8px',
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 4,
                    borderRadius: '2px',
                    backgroundColor: tokens.colors.textFaint,
                  }}
                />
              </div>
            )}
            <div style={{ padding: tokens.spacing.lg }}>{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
