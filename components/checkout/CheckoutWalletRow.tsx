'use client'

import { useCallback } from 'react'
import { Wallet } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { creditToApply } from '@/lib/checkout/credit-rule'

export type WalletResult = {
  amount: number
  balance_after: number
}

type Props = {
  /** Amount still to pay after any promo code (what credit can cover). */
  originalTotal: number
  /** True when the applied promo code cannot be combined with Space Wallet credit. */
  blockedByPromo?: boolean
  walletBalance: number
  onApply: (result: WalletResult) => void
  onRemove: () => void
  activeWallet: WalletResult | null
}

export default function CheckoutWalletRow({
  originalTotal,
  blockedByPromo = false,
  walletBalance,
  onApply,
  onRemove,
  activeWallet,
}: Props) {
  const t = useTranslations('checkout')

  // Same rule as the server: card payment is HK$0 or at least HK$10.
  const applyAmount = creditToApply({ subtotal: originalTotal, promoDiscount: 0, balance: walletBalance })
  const canApply = applyAmount > 0 && !blockedByPromo

  const handleApply = useCallback(() => {
    const balanceAfter = walletBalance - applyAmount
    onApply({
      amount: applyAmount,
      balance_after: balanceAfter,
    })
  }, [walletBalance, applyAmount, onApply])

  const handleRemove = useCallback(() => {
    onRemove()
  }, [onRemove])

  // Hide if wallet balance is 0
  if (walletBalance === 0) {
    return null
  }

  const MUTED = 'rgba(255,255,255,0.72)'
  const FAINT = 'rgba(255,255,255,0.52)'
  const GREEN = '#22b86b'

  const cardStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '14px 16px',
    borderRadius: 14,
    border: `1px solid ${activeWallet ? 'rgba(34,184,107,0.45)' : 'rgba(255,255,255,0.14)'}`,
    background: activeWallet ? 'rgba(34,184,107,0.10)' : 'rgba(255,255,255,0.04)',
  }
  const iconStyle: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: 12,
    flexShrink: 0,
    display: 'grid',
    placeItems: 'center',
    background: activeWallet ? 'rgba(34,184,107,0.20)' : 'rgba(255,255,255,0.08)',
    color: activeWallet ? GREEN : MUTED,
  }
  const linkBtn: React.CSSProperties = {
    appearance: 'none',
    border: 'none',
    background: 'transparent',
    color: MUTED,
    cursor: 'pointer',
    padding: '8px 4px',
    fontSize: 13,
    textDecoration: 'underline',
    textUnderlineOffset: 3,
  }

  return (
    <div style={cardStyle}>
      <div style={iconStyle}>
        <Wallet size={20} />
      </div>

      {activeWallet ? (
        <>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{t('wallet.applied')}</div>
            <div style={{ fontSize: 12, color: FAINT, marginTop: 2 }}>
              {t('wallet.remaining')}: HK${activeWallet.balance_after}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: GREEN, fontVariantNumeric: 'tabular-nums' }}>
              −HK${activeWallet.amount}
            </div>
            <button type="button" onClick={handleRemove} style={linkBtn}>
              {t('wallet.remove')}
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Space Wallet</div>
            <div style={{ fontSize: 12, color: FAINT, marginTop: 2 }}>
              {canApply
                ? `${t('wallet.balance')}: HK$${walletBalance}`
                : blockedByPromo
                  ? t('wallet.not_stackable')
                  : t('wallet.insufficient')}
            </div>
          </div>
          {canApply && (
            <button
              type="button"
              onClick={handleApply}
              style={{
                appearance: 'none',
                border: 'none',
                background: GREEN,
                color: '#000',
                padding: '10px 18px',
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {t('wallet.apply')} −HK${applyAmount}
            </button>
          )}
        </>
      )}
    </div>
  )
}
