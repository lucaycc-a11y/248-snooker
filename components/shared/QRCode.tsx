'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import QRCodeLib from 'qrcode'
import { X } from 'lucide-react'

// Same mesh gradient as app/member/components/MemberCardPremier.tsx.
const MEMBER_CARD_BG = `
  radial-gradient(75% 85% at 100% 0%, #2f6e3b 0%, rgba(33,78,42,0.78) 28%, transparent 72%),
  radial-gradient(85% 90% at 0% 100%, #5d1393 0%, rgba(73,12,111,0.82) 30%, transparent 74%),
  radial-gradient(80% 85% at 100% 100%, #1d1b92 0%, rgba(22,18,99,0.88) 30%, transparent 75%),
  linear-gradient(135deg, #12051a 0%, #160b27 40%, #1b1338 100%)
`

const SPRING = { type: 'spring', stiffness: 320, damping: 30 } as const

async function renderQrDataUrl(data: string): Promise<string> {
  const svg = await QRCodeLib.toString(data, {
    type: 'svg',
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: '#0a0a0a', light: '#ffffff' },
  })

  // Return plain QR code without logo overlay for better scannability
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
  card = false,
}: {
  data?: string
  src?: string | null
  size?: number
  enlargeLabel?: string
  closeLabel?: string
  /** Member-card look (same mesh gradient + white rounded QR box as the member
   *  card). Use on every member-code QR so all QR displays match the card. */
  card?: boolean
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

  const trigger = (
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
  )

  return (
    <>
      {card ? (
        <div
          style={{
            width: 'fit-content',
            margin: '0 auto',
            padding: Math.round(size * 0.1),
            borderRadius: Math.round(size * 0.14),
            background: MEMBER_CARD_BG,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.12)',
          }}
        >
          <div style={{ background: '#fff', borderRadius: Math.round(size * 0.09), padding: Math.round(size * 0.05) }}>
            {trigger}
          </div>
        </div>
      ) : (
        trigger
      )}

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
