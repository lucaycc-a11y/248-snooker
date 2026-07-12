'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import QRCodeLib from 'qrcode'
import { X } from 'lucide-react'

const SPRING = { type: 'spring', stiffness: 320, damping: 30 } as const

async function renderQrDataUrl(data: string): Promise<string> {
  const svg = await QRCodeLib.toString(data, {
    type: 'svg',
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#0a0a0a', light: '#ffffff' },
  })
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

/**
 * Real, scannable QR code — either generated client-side from `data`, or
 * displaying a pre-rendered `src` (e.g. from an API that already returns a
 * data URL). Tap/click opens a large full-screen version for easier scanning.
 */
export function QRCode({
  data,
  src,
  size = 120,
  enlargeLabel = 'Tap to enlarge QR code',
  closeLabel = 'Close',
}: {
  data?: string
  src?: string | null
  size?: number
  enlargeLabel?: string
  closeLabel?: string
}) {
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!data) return
    let cancelled = false
    renderQrDataUrl(data)
      .then((url) => {
        if (!cancelled) setGeneratedUrl(url)
      })
      .catch(() => {
        /* leave placeholder on failure */
      })
    return () => {
      cancelled = true
    }
  }, [data])

  const url = src ?? generatedUrl

  return (
    <>
      <button
        type="button"
        onClick={() => url && setOpen(true)}
        aria-label={enlargeLabel}
        disabled={!url}
        style={{
          width: size,
          height: size,
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: url ? 'zoom-in' : 'default',
          display: 'block',
        }}
      >
        {url ? (
          <img
            src={url}
            width={size}
            height={size}
            alt="QR code"
            style={{ borderRadius: 8, display: 'block', width: size, height: size }}
          />
        ) : (
          <div aria-hidden="true" style={{ width: size, height: size, background: '#ffffff', borderRadius: 8 }} />
        )}
      </button>

      <AnimatePresence>
        {open && url && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={SPRING}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'relative',
                background: '#ffffff',
                borderRadius: 20,
                padding: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={closeLabel}
                style={{
                  position: 'absolute',
                  top: -44,
                  right: 0,
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'rgba(255,255,255,0.15)',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} />
              </button>
              <img
                src={url}
                alt="QR code"
                style={{ width: 'min(80vw, 320px)', height: 'min(80vw, 320px)', display: 'block' }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
