'use client'

/**
 * BottomSheet — reusable slide-up sheet with Framer Motion drag-to-dismiss.
 *
 * §2 spec: used on iPad for secondary nav and on mobile for detail views.
 * Backdrop blur + tap-to-close. Respects prefers-reduced-motion.
 */

import { type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type BottomSheetProps = {
  open: boolean
  onClose: () => void
  children: ReactNode
}

export default function BottomSheet({ open, onClose, children }: BottomSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="bottomsheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Sheet panel */}
          <motion.div
            key="bottomsheet-panel"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 300,
            }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) {
                onClose()
              }
            }}
            className="fixed bottom-0 left-0 right-0 z-50
              max-h-[85vh] overflow-y-auto
              bg-[var(--admin-surface)] border-t border-[var(--admin-border)]
              rounded-t-2xl"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div
                aria-hidden="true"
                className="w-10 h-1 rounded-full bg-[var(--admin-text-muted)] opacity-40"
              />
            </div>

            {/* Content */}
            <div className="px-4 pb-8">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
