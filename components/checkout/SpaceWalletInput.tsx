'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wallet, X, Check } from 'lucide-react'
import { POINTS_CREDIT_COPY } from '@/lib/copy/points-credit'

const GREEN = '#22b86b'
const MUTED = 'rgba(255,255,255,0.72)'
const BORDER = 'rgba(255,255,255,0.1)'
const GLASS_BG = '#111111'
const INK = '#ffffff'

const SPRING = { type: 'spring', stiffness: 320, damping: 30 } as const

export type WalletResult = {
  amount: number
  balance_after: number
}

type Props = {
  originalTotal: number
  walletBalance: number
  onApply: (result: WalletResult) => void
  onRemove: () => void
  activeWallet: WalletResult | null
  labels?: {
    balanceLabel: string
    applyButton: string
    removeLink: string
    appliedLabel: string
    insufficientLabel: string
  }
}

const DEFAULT_LABELS = {
  balanceLabel: 'Space Wallet 可用餘額',
  applyButton: '套用',
  removeLink: '移除',
  appliedLabel: '已套用 Space Wallet',
  insufficientLabel: 'Space Wallet 餘額不足',
}

export default function SpaceWalletInput({
  originalTotal,
  walletBalance,
  onApply,
  onRemove,
  activeWallet,
  labels: lbl,
}: Props) {
  const L = { ...DEFAULT_LABELS, ...lbl }
  const [open, setOpen] = useState(false)

  const canApply = walletBalance > 0 && originalTotal > 0
  const applyAmount = Math.min(walletBalance, originalTotal)

  const handleApply = useCallback(() => {
    const balanceAfter = walletBalance - applyAmount
    onApply({
      amount: applyAmount,
      balance_after: balanceAfter,
    })
    setOpen(false)
  }, [walletBalance, applyAmount, onApply])

  const handleRemove = useCallback(() => {
    onRemove()
    setOpen(false)
  }, [onRemove])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        paddingBottom: 12,
        borderBottom: activeWallet ? `1px solid ${BORDER}` : 'none',
      }}
    >
      <Wallet size={16} style={{ color: MUTED, flexShrink: 0 }} />

      {activeWallet ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, color: MUTED }}>{L.appliedLabel}</div>
            <div style={{ fontSize: 14, color: GREEN, fontWeight: 600 }}>−HK${activeWallet.amount}</div>
          </div>
          <button
            onClick={handleRemove}
            style={{
              appearance: 'none',
              border: 'none',
              background: 'transparent',
              color: MUTED,
              cursor: 'pointer',
              padding: '8px 12px',
              fontSize: 13,
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            {L.removeLink}
          </button>
        </div>
      ) : (
        <AnimatePresence>
          {open ? (
            <motion.div
              key="wallet-control"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={SPRING}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>
                  {L.balanceLabel}: HK${walletBalance}
                </div>
                {canApply ? (
                  <button
                    onClick={handleApply}
                    style={{
                      appearance: 'none',
                      border: `1px solid ${GREEN}`,
                      background: 'transparent',
                      color: GREEN,
                      padding: '8px 12px',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 200ms',
                    }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLButtonElement).style.background = `rgba(34, 184, 107, 0.1)`
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                    }}
                  >
                    {L.applyButton}
                  </button>
                ) : (
                  <div style={{ fontSize: 13, color: MUTED }}>{L.insufficientLabel}</div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.button
              key="wallet-toggle"
              onClick={() => setOpen(true)}
              style={{
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: MUTED,
                cursor: 'pointer',
                fontSize: 13,
                padding: '8px 12px',
                flex: 1,
                textAlign: 'left',
              }}
            >
              {L.balanceLabel}: HK${walletBalance}
            </motion.button>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}
