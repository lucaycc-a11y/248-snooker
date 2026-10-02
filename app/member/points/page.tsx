'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, AlertCircle, RotateCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

const SPRING = { type: 'spring', damping: 20, stiffness: 300 }

// ════════════════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════════════════

interface PointsData {
  lifetime: number
  redeemable: number
  converted: number
  depositedToWallet: number
  tier: string
  blockSize: number
  creditsPerBlock: number
}

interface Transaction {
  id: string
  type: 'earn' | 'convert' | 'wallet' | 'back'
  amount: number
  description: string
  created_at: string
  reference_id?: string
}

interface TransactionsResponse {
  transactions: Transaction[]
  hasMore: boolean
  nextCursor?: string
}

// ════════════════════════════════════════════════════════════════════════════
// Main Component
// ════════════════════════════════════════════════════════════════════════════

export default function PointsPage() {
  const t = useTranslations()
  const router = useRouter()

  const [pointsData, setPointsData] = useState<PointsData | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'earn' | 'wallet' | 'back'>('all')
  const [howExpanded, setHowExpanded] = useState(false)
  const [cursor, setCursor] = useState<string | undefined>()
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/member/points')

      if (res.status === 401) {
        router.push('/login')
        return
      }

      if (!res.ok) throw new Error('Failed to load points')

      const data = (await res.json()) as PointsData
      setPointsData(data)

      await loadTransactions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setPointsData(null)
    } finally {
      setLoading(false)
    }
  }

  const loadTransactions = useCallback(async (filterType: typeof filter = filter, resetCursor = true) => {
    try {
      const params = new URLSearchParams()
      if (filterType !== 'all') params.append('filter', filterType)
      if (!resetCursor && cursor) params.append('cursor', cursor)

      const res = await fetch(`/api/member/points/transactions?${params}`)
      if (!res.ok) throw new Error('Failed to load transactions')

      const data = (await res.json()) as TransactionsResponse

      if (resetCursor) {
        setTransactions(data.transactions)
      } else {
        setTransactions(prev => [...prev, ...data.transactions])
      }

      setHasMore(data.hasMore)
      setCursor(data.nextCursor)
    } catch (err) {
      console.error('Failed to load transactions:', err)
    }
  }, [filter, cursor])

  const handleFilterChange = (newFilter: typeof filter) => {
    setFilter(newFilter)
    setCursor(undefined)
    setTransactions([])
  }

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    await loadTransactions(filter, false)
    setLoadingMore(false)
  }

  const handleRetry = () => {
    loadData()
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Render: Loading state
  // ──────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="app wide" style={{ minHeight: '100vh' }}>
        <header className="top">
          <div></div>
          <h1 className="t gt">{t('member.points.title')}</h1>
          <div></div>
        </header>
        <div style={{ maxWidth: '960px', margin: '0 auto', padding: '20px' }}>
          <div className="skel sk-card" style={{ height: '200px', marginBottom: '20px' }} />
          <div className="skel" style={{ height: '40px', marginBottom: '20px' }} />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skel" style={{ height: '60px', marginBottom: '12px' }} />
          ))}
        </div>
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Render: Error state
  // ──────────────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="app wide" style={{ minHeight: '100vh' }}>
        <header className="top">
          <button className="icon-btn" onClick={() => router.back()} aria-label={t('common.back')}>
            <svg className="i" aria-hidden="true">
              <use href="#i-back" />
            </svg>
          </button>
          <h1 className="t gt">{t('member.points.title')}</h1>
          <span></span>
        </header>
        <div style={{ maxWidth: '520px', margin: '0 auto', padding: '20px' }}>
          <div className="alert" role="alert">
            <svg className="i" aria-hidden="true">
              <use href="#i-alert" />
            </svg>
            <div>
              <h3>{t('member.points.error_title')}</h3>
              <p>{error}</p>
              <button className="btn secondary sm" onClick={handleRetry}>
                <svg className="i" aria-hidden="true">
                  <use href="#i-refresh" />
                </svg>
                {t('common.retry')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!pointsData) {
    return (
      <div className="app wide" style={{ minHeight: '100vh' }}>
        <header className="top">
          <button className="icon-btn" onClick={() => router.back()} aria-label={t('common.back')}>
            <svg className="i" aria-hidden="true">
              <use href="#i-back" />
            </svg>
          </button>
          <h1 className="t gt">{t('member.points.title')}</h1>
          <span></span>
        </header>
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.6)' }}>
          {t('common.no_data')}
        </div>
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Calculations
  // ──────────────────────────────────────────────────────────────────────────

  const redeemableProgress = pointsData.redeemable % 100
  const blocksEarned = Math.floor(pointsData.redeemable / 100)

  // ──────────────────────────────────────────────────────────────────────────
  // Render: Main
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="app wide" style={{ minHeight: '100vh' }}>
      {/* Header */}
      <header className="top">
        <button className="icon-btn" onClick={() => router.back()} aria-label={t('common.back')}>
          <svg className="i" aria-hidden="true">
            <use href="#i-back" />
          </svg>
        </button>
        <h1 className="t gt">{t('member.points.title')}</h1>
        <span></span>
      </header>

      {/* Main grid: left = card, right = feed + sections */}
      <div className="grid" id="grid">
        {/* ────────────────────────────────────────────────────────────────────────── */}
        {/* Left Column: Card */}
        {/* ────────────────────────────────────────────────────────────────────────── */}

        <section className="col-l" aria-live="polite">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING}
            className="card"
            style={{
              background: 'linear-gradient(135deg, rgba(37,211,102,0.08), rgba(37,211,102,0.02))',
              border: '1px solid rgba(37,211,102,0.1)',
              borderRadius: '20px',
              padding: '24px',
            }}
          >
            {/* Stat 1: Lifetime */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {t('member.points.lifetime')}
              </div>
              <div style={{ fontSize: '32px', fontWeight: '600', color: 'rgba(255,255,255,0.95)', fontFamily: 'Good Times' }}>
                {pointsData.lifetime.toLocaleString()}
              </div>
            </div>

            {/* Stat 2: Redeemable + Progress */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {t('member.points.redeemable')}
              </div>
              <div style={{ fontSize: '24px', fontWeight: '600', color: 'rgba(37,211,102,0.95)', fontFamily: 'Good Times', marginBottom: '8px' }}>
                {redeemableProgress} / 100
              </div>
              <div style={{
                height: '6px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '3px',
                overflow: 'hidden',
              }}>
                <motion.div
                  style={{
                    height: '100%',
                    background: '#25D366',
                    width: `${redeemableProgress}%`,
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${redeemableProgress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '24px 0' }} />

            {/* Stat 3: Deposited */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {t('member.points.deposited_to_wallet')}
              </div>
              <div style={{ fontSize: '24px', fontWeight: '600', color: 'rgba(255,255,255,0.95)', fontFamily: 'Good Times' }}>
                HK${pointsData.depositedToWallet.toLocaleString()}
              </div>
            </div>

            {/* Stat 4: Converted */}
            <div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {t('member.points.converted')}
              </div>
              <div style={{ fontSize: '24px', fontWeight: '600', color: 'rgba(255,255,255,0.95)', fontFamily: 'Good Times' }}>
                {pointsData.converted.toLocaleString()}
              </div>
            </div>

            {/* Tier Badge */}
            <div style={{ marginTop: '24px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {getTierBadge(pointsData.tier)}
            </div>
          </motion.div>
        </section>

        {/* ────────────────────────────────────────────────────────────────────────── */}
        {/* Right Column: Feed + Sections */}
        {/* ────────────────────────────────────────────────────────────────────────── */}

        <div id="listArea" className="col-r">
          <div className="sticky" style={{ top: 0, zIndex: 10 }}>
            {/* Filter Tabs */}
            <div className="tabs" role="tablist" aria-label={t('member.points.filter')}>
              {(['all', 'earn', 'wallet', 'back'] as const).map((f) => (
                <button
                  key={f}
                  className="tab"
                  role="tab"
                  aria-selected={filter === f}
                  data-tab={f}
                  onClick={() => handleFilterChange(f)}
                >
                  {t(`member.points.filter_${f}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Transactions Feed */}
          <div id="panel" role="tabpanel">
            {transactions.length === 0 ? (
              <div className="empty" style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
                  {t('member.points.no_transactions')}
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {transactions.map((tx) => (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="row"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '14px 16px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '12px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)', fontWeight: '500' }}>
                          {tx.description}
                        </div>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                          {new Date(tx.created_at).toLocaleDateString('zh-HK')}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          fontFamily: 'Good Times',
                          color: tx.type === 'back' ? 'rgba(255,99,71,0.9)' : 'rgba(37,211,102,0.9)',
                        }}>
                          {tx.type === 'back' ? '-' : '+'}{tx.amount.toLocaleString()}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {hasMore && (
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    style={{
                      width: '100%',
                      marginTop: '16px',
                      padding: '12px',
                      background: 'rgba(37,211,102,0.1)',
                      border: '1px solid rgba(37,211,102,0.2)',
                      borderRadius: '12px',
                      color: '#25D366',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: loadingMore ? 'not-allowed' : 'pointer',
                      opacity: loadingMore ? 0.6 : 1,
                    }}
                  >
                    {loadingMore ? t('common.loading') : t('common.load_more')}
                  </button>
                )}
              </>
            )}
          </div>

          {/* 如何運作 Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{ marginTop: '24px' }}
          >
            <button
              onClick={() => setHowExpanded(!howExpanded)}
              style={{
                width: '100%',
                padding: '16px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
              }}
            >
              <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px', fontWeight: '500', textAlign: 'left' }}>
                {t('member.points.how_it_works')}
              </div>
              <motion.svg
                className="i"
                aria-hidden="true"
                style={{ width: '20px', height: '20px', flex: 'none' }}
                animate={{ rotate: howExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <use href="#i-chevron-down" />
              </motion.svg>
            </button>

            <AnimatePresence>
              {howExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{
                    marginTop: '12px',
                    padding: '16px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '12px',
                    fontSize: '13px',
                    color: 'rgba(255,255,255,0.7)',
                    lineHeight: '1.6',
                  }}>
                    {t('member.points.how_it_works_content')}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* 等級禮遇 Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{ marginTop: '24px' }}
          >
            <div style={{
              padding: '16px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px', fontWeight: '500' }}>
                {t('member.points.tier_perks')}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {t('member.points.pending')}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════════════

function getTierBadge(tier: string): string {
  const tierMap: Record<string, string> = {
    bronze: '銅級會員',
    silver: '銀級會員',
    gold: '金級會員',
    platinum: '白金會員',
  }
  return tierMap[tier] || tier
}
