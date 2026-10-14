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
  // Credit was held back by the HK$10 minimum card payment rule.
  const showMinNote =
    !!activeWallet && activeWallet.amount < Math.min(walletBalance, originalTotal)

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
  const GREEN = '#22b86b'
  const BORDER = 'rgba(255,255,255,0.1)'

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
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
            <div style={{ fontSize: 13, color: MUTED }}>{t('wallet.applied')}</div>
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
            {t('wallet.remove')}
          </button>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, color: MUTED }}>
              {t('wallet.balance')}: HK${walletBalance}
            </div>
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
              {t('wallet.apply')}
            </button>
          ) : (
            <div style={{ fontSize: 13, color: MUTED }}>
              {blockedByPromo ? t('wallet.not_stackable') : t('wallet.insufficient')}
            </div>
          )}
        </div>
      )}
      {showMinNote && activeWallet && (
        <div style={{ flexBasis: '100%', fontSize: 12, color: MUTED, marginTop: 8 }}>
          {t('wallet.min_note', { used: activeWallet.amount, left: walletBalance - activeWallet.amount })}
        </div>
      )}
    </div>
  )
}
