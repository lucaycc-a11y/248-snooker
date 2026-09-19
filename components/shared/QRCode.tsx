'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import QRCodeLib from 'qrcode'
import { X } from 'lucide-react'

// Logo inlined as a base64 data URI so it resolves correctly when the outer SVG
// is itself embedded as a data:image/svg+xml;base64,… URL. A relative href like
// "/logos/logo-white-mark.svg" has no origin to resolve against in that context.
const SPACE8_QR_LOGO_DATA_URI =
  'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyBpZD0iTGF5ZXJfMSIgZGF0YS1uYW1lPSJMYXllciAxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAwIDEwMDAiPgogIDxkZWZzPgogICAgPHN0eWxlPgogICAgICAuY2xzLTEgewogICAgICAgIGZpbGw6ICNmZmY7CiAgICAgIH0KICAgIDwvc3R5bGU+CiAgPC9kZWZzPgogIDxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTM5MS4zMSw3ODYuMTFjLTk0LjExLDAtMTU1LjA4LTY4LjQ4LTE1NS4wOC0xNzMuMTYsMC02Ni45LDMxLjgxLTExMi41NSw3NS41NS0xMjkuMDgtMzUuNzktMTMuMzgtNjYuMjctNDkuNTktNjYuMjctMTIyLDAtOTcuNiw2MS42My0xNDcuOTcsMTU1LjA4LTE0Ny45N2gxOTguODFjOTMuNDQsMCwxNTUuNzQsNTAuMzcsMTU1Ljc0LDE0Ny45NywwLDcyLjQxLTMxLjE1LDEwOC42Mi02Ni45MywxMjIsNDMuNzQsMTYuNTMsNzUuNTUsNjIuMTgsNzUuNTUsMTI5LjA4LDAsMTA0LjY4LTYwLjk3LDE3My4xNi0xNTUuMDgsMTczLjE2aC0yMTcuMzdaTTM5NC42Myw1MzcuMzljLTQ3LjA1LDAtNzMuNTYsMjYuNzYtNzMuNTYsNzMuOTksMCw0OS41OSwzNy43Nyw3NC43Nyw5MC43OSw3NC43N2gxNzYuMjhjNTMuMDIsMCw5MC43OS0yNS4xOSw5MC43OS03NC43N3MtMjYuNTEtNzMuOTktNzMuNTYtNzMuOTloLTIxMC43NFpNNDE2LjUsMzEzLjA3Yy01NS4wMSwwLTg2LjE1LDE4LjEtODYuMTUsNzAuODQsMCw0OS41OSwyMi41Myw2OS4yNiw3MC4yNSw2OS4yNmgxOTguODFjNDcuNzIsMCw3MC4yNS0xOS42OCw3MC4yNS02OS4yNiwwLTUyLjc0LTMxLjE1LTcwLjg0LTg2LjE1LTcwLjg0aC0xNjdaIi8+CiAgPGc+CiAgICA8cGF0aCBjbGFzcz0iY2xzLTEiIGQ9Ik01MDkuNCw1Mi4xNWMtMjE2LjIyLDAtMzk4LjMsMTQzLjI0LTQ1Mi44NCwzMzguMTZoLTE5Ljc5QzkwLjcsMTg0Ljg5LDI3Ny42NSwzMy4zNSw1MDAsMzMuMzVzNDA5LjMsMTUxLjUzLDQ2My4yNCwzNTYuOTZoLTFjLTU0LjU0LTE5NC45My0yMzYuNjItMzM4LjE2LTQ1Mi44NC0zMzguMTZaIi8+CiAgICA8cGF0aCBjbGFzcz0iY2xzLTEiIGQ9Ik05NzkuMTUsNDAyLjU4aC0yNi4yMmwtMi41MS04Ljk2Yy01NC4yMy0xOTMuODMtMjM1LjU5LTMyOS4yLTQ0MS4wMi0zMjkuMlMxMjIuNiwxOTkuNzksNjguMzcsMzkzLjYybC0yLjUxLDguOTZIMjAuODVsNC4wNC0xNS4zOWMxMy42NS01MiwzNS42OS0xMDEuMTYsNjUuNTEtMTQ2LjExLDI5LjMzLTQ0LjIyLDY1LjQyLTgzLjI0LDEwNy4yNi0xMTUuOTYsNDIuMjYtMzMuMDUsODkuMjYtNTguNzgsMTM5LjY3LTc2LjQ3LDUyLjE2LTE4LjMsMTA2Ljg4LTI3LjU4LDE2Mi42Ni0yNy41OHMxMTAuNTEsOS4yOCwxNjIuNjYsMjcuNThjNTAuNDEsMTcuNjksOTcuNDEsNDMuNDIsMTM5LjY3LDc2LjQ3LDQxLjg0LDMyLjcyLDc3LjkzLDcxLjc0LDEwNy4yNiwxMTUuOTYsMjkuODIsNDQuOTUsNTEuODYsOTQuMTEsNjUuNTEsMTQ2LjExbDQuMDQsMTUuMzlaIi8+CiAgPC9nPgogIDxnPgogICAgPHBhdGggY2xhc3M9ImNscy0xIiBkPSJNNTA5LjQsOTQ3Ljg1Yy0yMTYuMjIsMC0zOTguMy0xNDMuMjQtNDUyLjg0LTMzOC4xNmgtMTkuNzljNTMuOTQsMjA1LjQzLDI0MC44OSwzNTYuOTYsNDYzLjI0LDM1Ni45NnM0MDkuMy0xNTEuNTMsNDYzLjI0LTM1Ni45NmgtMWMtNTQuNTQsMTk0LjkzLTIzNi42MiwzMzguMTYtNDUyLjg0LDMzOC4xNloiLz4KICAgIDxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTUwMCw5NzguOTJjLTU1Ljc4LDAtMTEwLjUxLTkuMjgtMTYyLjY2LTI3LjU4LTUwLjQxLTE3LjY5LTk3LjQxLTQzLjQyLTEzOS42Ny03Ni40Ny00MS44NC0zMi43Mi03Ny45My03MS43NC0xMDcuMjYtMTE1Ljk2LTI5LjgyLTQ0Ljk1LTUxLjg2LTk0LjExLTY1LjUxLTE0Ni4xMWwtNC4wNC0xNS4zOWg0NS4wMWwyLjUxLDguOTZjNTQuMjMsMTkzLjgzLDIzNS41OSwzMjkuMiw0NDEuMDMsMzI5LjJzMzg2Ljc5LTEzNS4zNyw0NDEuMDItMzI5LjJsMi41MS04Ljk2aDI2LjIybC00LjA0LDE1LjM5Yy0xMy42NSw1Mi0zNS42OSwxMDEuMTYtNjUuNTEsMTQ2LjExLTI5LjMzLDQ0LjIyLTY1LjQyLDgzLjI0LTEwNy4yNiwxMTUuOTYtNDIuMjYsMzMuMDUtODkuMjYsNTguNzgtMTM5LjY3LDc2LjQ3LTUyLjE2LDE4LjMtMTA2Ljg4LDI3LjU4LTE2Mi42NiwyNy41OFoiLz4KICA8L2c+Cjwvc3ZnPg=='

const SPRING = { type: 'spring', stiffness: 320, damping: 30 } as const

async function renderQrDataUrl(data: string): Promise<string> {
  const svg = await QRCodeLib.toString(data, {
    type: 'svg',
    margin: 2,
    errorCorrectionLevel: 'H',
    color: { dark: '#0a0a0a', light: '#ffffff' },
  })
  const brandedSvg = svg.replace(
    '</svg>',
    `<rect x="42.5%" y="42.5%" width="15%" height="15%" rx="3" fill="#ffffff"/><image href="${SPACE8_QR_LOGO_DATA_URI}" x="44%" y="44%" width="12%" height="12%" preserveAspectRatio="xMidYMid meet"/></svg>`,
  )
  return `data:image/svg+xml;base64,${btoa(brandedSvg)}`
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
