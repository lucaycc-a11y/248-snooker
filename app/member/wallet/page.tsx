'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wallet, ArrowLeft, History, X, ChevronDown, TrendingDown, TrendingUp } from 'lucide-react'
import { useTranslations } from 'next-intl'

type WalletSummary = {
  credits: number
  lifetimePoints: number
  redeemablePoints: number
  convertedPoints: number
  tier: string
}

type CreditLedgerEntry = {
  amount: number
  type: 'convert' | 'signup' | 'topup' | 'redeem' | 'refund' | 'reversal' | 'manual'
  note: string | null
  balanceAfter: number
  createdAt: string
}

export default function WalletPage() {
  const t = useTranslations('member.wallet_page')
  const [summary, setSummary] = useState<WalletSummary | null>(null)
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [page, setPage] = useState(0)
  const pageSize = 20

  useEffect(() => {
    loadSummary()
    loadLedger()
  }, [])

  useEffect(() => {
    if (showHistory) {
      loadLedger(page)
    }
  }, [page, showHistory])

  const loadSummary = async () => {
    try {
      const res = await fetch('/api/member/wallet')
      if (res.ok) {
        const data = await res.json()
        setSummary(data)
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
    }
  }

  const loadLedger = async (p = 0) => {
    try {
      const res = await fetch(`/api/member/wallet/ledger?page=${p}`)
      if (res.ok) {
        const data = await res.json()
        setLedger(data.entries || [])
      }
    } catch {
      // Silent fail
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#05070C] via-[#0A0D12] to-[#0F131C]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#05070C] via-[#0A0D12] to-[#0F131C]">
        <p className="text-white/60">{t('error_loading')}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05070C] via-[#0A0D12] to-[#0F131C]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0A0D12]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="flex items-center justify-between">
            <a
              href="/member"
              className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/10"
            >
              <ArrowLeft className="h-5 w-5 text-white/60" />
            </a>
            <h1 className="text-lg font-semibold text-white">{t('title')}</h1>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/10"
            >
              <History className="h-5 w-5 text-white/60" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="mx-auto max-w-3xl px-4 pb-8 pt-8">
        {/* Credits Display Card - Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-8 backdrop-blur-xl"
        >
          {/* Floating orbs background */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl" />

          <div className="relative z-10">
            {/* Wallet Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm">
              <Wallet className="h-5 w-5 text-emerald-400" />
              <span className="text-sm font-medium text-white">{t('available_credits')}</span>
            </div>

            {/* Credits Display */}
            <div className="mb-2">
              <p className="text-sm font-medium uppercase tracking-wider text-white/50">
                {t('wallet_balance')}
              </p>
              <div className="font-code mt-2 flex items-baseline gap-2">
                <span className="text-6xl font-bold tracking-tight text-white">
                  {summary.credits}
                </span>
                <span className="text-2xl text-white/50">HK$</span>
              </div>
            </div>

            {/* Info Text */}
            <p className="mt-6 text-sm leading-relaxed text-white/60">
              {t('wallet_description')}
            </p>
          </div>
        </motion.div>

        {/* Quick Stats */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-white/50">{t('lifetime_points')}</p>
            <p className="mt-2 text-2xl font-bold text-white">{summary.lifetimePoints.toLocaleString()}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-white/50">{t('current_tier')}</p>
            <p className="mt-2 text-2xl font-bold text-white capitalize">{summary.tier}</p>
          </motion.div>
        </div>
      </div>

      {/* History Modal */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowHistory(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-0 left-0 right-0 z-50 max-h-[80vh] overflow-auto rounded-t-3xl border-t border-white/10 bg-[#0A0D12] backdrop-blur-xl"
            >
              <div className="sticky top-0 border-b border-white/5 bg-[#0A0D12]/80 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">{t('transaction_history')}</h2>
                  <button
                    onClick={() => setShowHistory(false)}
                    className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/10"
                  >
                    <X className="h-5 w-5 text-white/60" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 px-6 py-4">
                {ledger.length === 0 ? (
                  <p className="py-8 text-center text-white/50">{t('no_transactions')}</p>
                ) : (
                  ledger.map((entry, idx) => (
                    <motion.div
                      key={`${entry.createdAt}-${idx}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-4 hover:bg-white/10"
                    >
                      <div className="flex flex-1 items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                          {entry.amount > 0 ? (
                            <TrendingUp className="h-5 w-5 text-emerald-400" />
                          ) : (
                            <TrendingDown className="h-5 w-5 text-orange-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white capitalize">{entry.type}</p>
                          {entry.note && <p className="text-xs text-white/50">{entry.note}</p>}
                          <p className="text-xs text-white/40">
                            {new Date(entry.createdAt).toLocaleDateString('zh-HK', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${entry.amount > 0 ? 'text-emerald-400' : 'text-orange-400'}`}>
                          {entry.amount > 0 ? '+' : ''}{entry.amount}
                        </p>
                        <p className="text-xs text-white/50">Balance: {entry.balanceAfter}</p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Pagination */}
              {ledger.length === pageSize && (
                <div className="flex gap-2 border-t border-white/5 px-6 py-4">
                  <button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    className="flex-1 rounded-lg border border-white/10 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 hover:enabled:bg-white/10"
                  >
                    {t('previous')}
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    className="flex-1 rounded-lg border border-white/10 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
                  >
                    {t('next')}
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
