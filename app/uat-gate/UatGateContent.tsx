'use client'

import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { Starfield } from '@/app/[locale]/Starfield'
import { AmbientGlow } from '@/components/shared/AmbientGlow'
import { Logo } from '@/components/brand/Logo'
import { PasswordInput } from '@/components/shared/PasswordInput'

const LONG_PRESS_MS = 800

export default function UatGateContent() {
  const [unlockVisible, setUnlockVisible] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function startPress() {
    pressTimer.current = setTimeout(() => {
      setUnlockVisible(true)
    }, LONG_PRESS_MS)
  }

  function cancelPress() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  function dismiss() {
    setUnlockVisible(false)
    setError(null)
    setPassword('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/gate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        window.location.href = '/'
        return
      }
      setError(res.status === 429 ? '嘗試次數過多，請稍後再試' : '密碼不正確')
    } catch {
      setError('嘗試次數過多，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="glass-panel"
            style={{ padding: 32, maxWidth: 360, width: '100%', position: 'relative' }}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <X size={20} color="#86868B" />
            </button>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoFocus
                style={{
                  height: 52,
                  padding: '0 16px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  fontSize: 16,
                  outline: 'none',
                }}
              />
              {error && (
                <p role="alert" style={{ color: '#f87171', fontSize: 13 }}>
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading || !password}
                style={{
                  height: 52,
                  borderRadius: 9999,
                  background: GREEN,
                  color: '#000',
                  fontWeight: 700,
                  fontSize: 16,
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading || !password ? 0.6 : 1,
                }}
              >
                {loading ? 'Unlocking...' : 'Unlock UAT'}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function UatGateContent() {
  const [modalOpen, setModalOpen] = useState(false)
  const [countdown, setCountdown] = useState(30)

  useEffect(() => {
    // Redirect to production after 30 seconds if no interaction
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.location.href = 'https://www.space8.com.hk'
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  return (
    <main
      style={{
        position: 'relative',
        isolation: 'isolate',
        minHeight: '100vh',
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        overflow: 'hidden',
      }}
    >
      <Starfield />
      <AmbientGlow variant="gemini" />

      <section
        className="glass-panel"
        style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 440, padding: 40 }}
      >
        <div style={{ textAlign: 'center' }}>
          {/* Long-press the logo to reveal the unlock form — intentionally no visible hint */}
          <div
            data-testid="gate-unlock-trigger"
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: 16,
              minHeight: 44,
              alignItems: 'center',
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
              userSelect: 'none',
            }}
            onMouseDown={startPress}
            onMouseUp={cancelPress}
            onMouseLeave={cancelPress}
            onTouchStart={startPress}
            onTouchEnd={cancelPress}
            onTouchCancel={cancelPress}
            onContextMenu={(e) => e.preventDefault()}
          >
            <Logo variant="full" theme="dark" size={48} />
          </div>

          <h1
            style={{
              fontFamily: '"Bebas Neue", sans-serif',
              fontSize: 40,
              letterSpacing: '0.02em',
              color: '#fff',
              marginBottom: 12,
            }}
          >
            內部測試中
          </h1>
          <p style={{ color: '#A1A1A6', fontSize: 15, lineHeight: 1.5, marginBottom: 24 }}>
            This is the UAT testing environment.
            <br />
            Redirecting to production in <strong style={{ color: GREEN }}>{countdown}s</strong>...
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            style={{
              width: '100%',
              height: 52,
              marginBottom: 16,
              borderRadius: 9999,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.16)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.12)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
            }}
          >
            Enter Password
          </button>
          {/* ignore-value design-system-color '#666' */}
          <p style={{ color: '#666', fontSize: 13 }}>
            Or hold anywhere on screen for 2.5 seconds
          </p>
        </div>

        <AnimatePresence>
          {unlockVisible && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.2, 0.7, 0.3, 1] }}
            >
              <form
                onSubmit={submit}
                style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}
              >
                {/* Row: password field + close button side by side */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <PasswordInput
                      data-testid="gate-password-input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="輸入密碼"
                      autoFocus
                      disabled={loading}
                      style={{
                        height: 52,
                        padding: '0 16px',
                        borderRadius: 12,
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#fff',
                        fontSize: 16,
                        outline: 'none',
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={dismiss}
                    aria-label="取消"
                    style={{
                      flexShrink: 0,
                      width: 44,
                      height: 44,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 12,
                      cursor: 'pointer',
                      color: '#86868B',
                    }}
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>

                {error && (
                  <p role="alert" style={{ color: '#f87171', fontSize: 13, margin: 0 }}>
                    {error}
                  </p>
                )}

                <button
                  data-testid="gate-submit"
                  type="submit"
                  disabled={loading || !password}
                  style={{
                    height: 52,
                    borderRadius: 9999,
                    background: '#22c55e',
                    color: '#000',
                    fontWeight: 700,
                    fontSize: 16,
                    border: 'none',
                    cursor: loading || !password ? 'not-allowed' : 'pointer',
                    opacity: loading || !password ? 0.6 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  {loading ? '驗證中…' : '進入'}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </main>
  )
}
