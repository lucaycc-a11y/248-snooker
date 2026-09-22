'use client'

import { motion } from 'framer-motion'
import { useTranslations, useLocale } from 'next-intl'
import { type PointsTransaction } from '@/lib/data/memberRedesignTypes'

// ════════════════════════════════════════════════════════════════════════════
// PointsHistory — P3: Transaction ledger display
// Shows points earned, spent, and refunded with categorization
// ════════════════════════════════════════════════════════════════════════════

type Props = {
  points: PointsTransaction[]
}

export function PointsHistory({ points }: Props) {
  const t = useTranslations('member.points')
  const locale = useLocale()

  if (points.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl bg-white/5 py-16 text-center backdrop-blur">
        <span className="text-6xl opacity-30">💎</span>
        <p className="mt-4 text-white/60">{t('empty_state')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {points.map((transaction, index) => (
        <motion.div
          key={transaction.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <TransactionRow transaction={transaction} locale={locale} />
        </motion.div>
      ))}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § TRANSACTION ROW
// ────────────────────────────────────────────────────────────────────────────

function TransactionRow({ transaction, locale }: { transaction: PointsTransaction; locale: string }) {
  const t = useTranslations('member.points')
  const isPositive = transaction.delta > 0
  const categoryIcon = getCategoryIcon(transaction.category)
  const categoryColor = getCategoryColor(transaction.category)

  return (
    <div className="flex items-center justify-between rounded-xl bg-white/5 p-4 backdrop-blur transition-colors hover:bg-white/10">
      {/* Left: Icon + Description */}
      <div className="flex items-center gap-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${categoryColor}`}>
          <span className="text-lg">{categoryIcon}</span>
        </div>
        <div>
          <p className="font-medium text-white">{transaction.description}</p>
          <p className="text-xs text-white/40">
            {new Date(transaction.created_at).toLocaleDateString(locale, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Right: Delta + Balance */}
      <div className="text-right">
        <p className={`font-code text-lg ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {isPositive ? '+' : ''}
          {transaction.delta.toLocaleString()}
        </p>
        <p className="font-label text-xs text-white/40">
          {t('balance')}: <span className="font-code">{transaction.balance_after.toLocaleString()}</span>
        </p>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § CATEGORY HELPERS
// ────────────────────────────────────────────────────────────────────────────

function getCategoryIcon(category: string): string {
  switch (category) {
    case 'booking':
      return '🎱'
    case 'redeem':
      return '🎁'
    case 'refund':
      return '↩️'
    case 'manual':
      return '✨'
    case 'birthday':
      return '🎂'
    default:
      return '💎'
  }
}

function getCategoryColor(category: string): string {
  switch (category) {
    case 'booking':
      return 'bg-blue-500/20'
    case 'redeem':
      return 'bg-purple-500/20'
    case 'refund':
      return 'bg-amber-500/20'
    case 'manual':
      return 'bg-cyan-500/20'
    case 'birthday':
      return 'bg-orange-500/20'
    default:
      return 'bg-gray-500/20'
  }
}
