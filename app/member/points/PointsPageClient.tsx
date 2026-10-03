'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import type {
  PointsSummary,
  PointsTransactionItem,
  PointsTransactionsResponse,
} from '@/lib/member-contracts'
import { formatMonth, formatDayMonth, formatHkd } from '@/lib/member-format'
import { USER_TIERS } from '@/lib/ledger-types'

type LoadState = 'loading' | 'ready' | 'error'
type FilterType = 'all' | 'earn' | 'wallet' | 'back'

export default function PointsPageClient() {
  const t = useTranslations('points')
  const [state, setState] = useState<LoadState>('loading')
  const [summary, setSummary] = useState<PointsSummary | null>(null)
  const [transactions, setTransactions] = useState<PointsTransactionItem[]>([])
  const [filter, setFilter] = useState<FilterType>('all')
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setState('loading')
      const res = await fetch('/api/member/points')
      if (!res.ok) throw new Error('Failed to fetch')

      const data = await res.json()
      setSummary(data.summary)
      setTransactions(data.transactions.items)
      setHasMore(data.transactions.hasMore)
      setNextCursor(data.transactions.nextCursor)
      setState('ready')
    } catch (err) {
      setState('error')
      console.error('Failed to load points:', err)
    }
  }

  async function loadMore() {
    if (!nextCursor) return

    try {
      const res = await fetch(`/api/member/points/transactions?cursor=${nextCursor}`)
      if (!res.ok) throw new Error('Failed to fetch')

      const data: PointsTransactionsResponse = await res.json()
      setTransactions((prev) => [...prev, ...data.items])
      setHasMore(data.hasMore)
      setNextCursor(data.nextCursor)
    } catch (err) {
      console.error('Failed to load more:', err)
    }
  }

  if (state === 'loading') {
    return <LoadingSkeleton />
  }

  if (state === 'error') {
    return <ErrorView onRetry={loadData} />
  }

  if (!summary) return null

  const redeemable = summary.redeemable
  const blockSize = summary.blockSize
  const progress = (redeemable / blockSize) * 100
  const needed = blockSize - redeemable

  return (
    <div className="grid">
      <section className="col-l">
        <PointsCard
          tier={summary.tier}
          lifetime={summary.lifetime}
          redeemable={redeemable}
          blockSize={blockSize}
          progress={progress}
          needed={needed}
          deposited={summary.depositedToWallet}
          converted={summary.convertedPoints}
          creditsPerBlock={summary.creditsPerBlock}
        />
        <div className="acts">
          <a className="btn primary" href="/booking">
            {t('bookNow')}
          </a>
          <a className="btn secondary" href="/member/wallet">
            {t('viewWallet')}
          </a>
        </div>
      </section>

      <div className="col-r">
        <h2 className="sec">{t('activity')}</h2>
        <FilterChips filter={filter} onFilterChange={setFilter} />
        <TransactionsList
          transactions={transactions}
          filter={filter}
        />
        {hasMore && filter === 'all' && (
          <button className="btn secondary more" onClick={loadMore}>
            {t('loadMore')}
          </button>
        )}

        <HowItWorksFold />
        <TierBenefitsFold />
      </div>
    </div>
  )
}

function PointsCard({
  tier,
  lifetime,
  redeemable,
  blockSize,
  progress,
  needed,
  deposited,
  converted,
  creditsPerBlock,
}: {
  tier: string
  lifetime: number
  redeemable: number
  blockSize: number
  progress: number
  needed: number
  deposited: number
  converted: number
  creditsPerBlock: number
}) {
  const t = useTranslations('points')

  const tierNames: Record<string, string> = {
    amateur: t('tierAmateur'),
    century: t('tierCentury'),
    maximum: t('tierMaximum'),
  }

  return (
    <div className="pcard">
      <span className="badge">
        <svg className="i" aria-hidden="true">
          <use href="#i-gem" />
        </svg>
        {tierNames[tier] || tier}
      </span>
      <p className="p-label">{t('lifetimePoints')}</p>
      <p className="p-big gt" aria-label={`${t('lifetimePoints')} ${lifetime}`}>
        {lifetime.toLocaleString('en-HK')}
      </p>
      <div className="prog">
        <div className="prog-h">
          <span>{t('redeemablePoints')}</span>
          <span className="gt">
            {redeemable} <i>/ {blockSize}</i>
          </span>
        </div>
        <div
          className="bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={blockSize}
          aria-valuenow={redeemable}
        >
          <i style={{ width: `${progress}%` }} />
        </div>
        <p className="need">
          {t('needMore', { points: needed, amount: creditsPerBlock })}
        </p>
      </div>
      <div className="stats">
        <div className="stat">
          <p>{t('depositedToWallet')}</p>
          <b>{formatHkd(deposited)}</b>
        </div>
        <div className="stat">
          <p>{t('convertedPoints')}</p>
          <b>{converted.toLocaleString('en-HK')}</b>
        </div>
      </div>
    </div>
  )
}

function FilterChips({
  filter,
  onFilterChange,
}: {
  filter: FilterType
  onFilterChange: (f: FilterType) => void
}) {
  const t = useTranslations('points')
  const filters: FilterType[] = ['all', 'earn', 'wallet', 'back']

  return (
    <div className="chips" role="group" aria-label={t('filterLabel')}>
      {filters.map((f) => (
        <button
          key={f}
          className="chip"
          aria-pressed={filter === f}
          onClick={() => onFilterChange(f)}
        >
          {t(`filter.${f}`)}
        </button>
      ))}
    </div>
  )
}

function TransactionsList({
  transactions,
  filter,
}: {
  transactions: PointsTransactionItem[]
  filter: FilterType
}) {
  const t = useTranslations('points')

  const filtered = transactions.filter((tx) => {
    if (filter === 'all') return true
    if (filter === 'earn') return tx.source === 'points' && tx.points > 0
    if (filter === 'wallet') return tx.source === 'credits' && tx.type === 'convert'
    if (filter === 'back') return tx.points < 0 && tx.type !== 'convert'
    return true
  })

  if (filtered.length === 0) {
    return <EmptyState filter={filter} />
  }

  // Group by month
  const grouped = filtered.reduce(
    (acc, tx) => {
      const month = tx.createdAt.slice(0, 7)
      if (!acc[month]) acc[month] = []
      acc[month].push(tx)
      return acc
    },
    {} as Record<string, PointsTransactionItem[]>
  )

  const months = Object.keys(grouped).sort().reverse()

  return (
    <>
      {months.map((month) => (
        <div key={month}>
          <div className="month">{formatMonth(month + '-01')}</div>
          <div className="group">
            {grouped[month].map((tx) => (
              <TransactionRow key={tx.id} transaction={tx} />
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

function TransactionRow({ transaction: tx }: { transaction: PointsTransactionItem }) {
  const t = useTranslations('points')

  const isPositive = tx.points > 0
  const icon = getIconForTransaction(tx)

  return (
    <div className="row">
      <span className={`ic ${isPositive ? 'pos' : ''}`}>
        <svg className="i" aria-hidden="true">
          <use href={`#i-${icon}`} />
        </svg>
      </span>
      <div>
        <div className="r-t">{t(`txType.${tx.type}`)}</div>
        <div className="r-s">{formatDayMonth(tx.createdAt)}</div>
        <div className="r-s r-d">{tx.note}</div>
      </div>
      <div
        className="amt"
        aria-label={`${isPositive ? t('earned') : t('deducted')} ${Math.abs(tx.points)} ${t('points')}`}
      >
        <b className={isPositive ? 'pos' : ''}>
          {isPositive ? '+' : '−'}
          {Math.abs(tx.points).toLocaleString('en-HK')}
        </b>
        <small>{t('points')}</small>
        {tx.depositedHkd !== null && (
          <small className="sv">{formatHkd(tx.depositedHkd)}</small>
        )}
      </div>
    </div>
  )
}

function getIconForTransaction(tx: PointsTransactionItem): string {
  if (tx.source === 'credits' && tx.type === 'convert') return 'swap'
  if (tx.type === 'signup') return 'gift'
  if (tx.type === 'bonus') return 'spark'
  if (tx.points > 0) return 'cal'
  return 'minus'
}

function EmptyState({ filter }: { filter: FilterType }) {
  const t = useTranslations('points')

  return (
    <div className="empty">
      <div className="ic">
        <svg className="i" aria-hidden="true">
          <use href="#i-gem" />
        </svg>
      </div>
      <h3>{t(`empty.${filter}.title`)}</h3>
      <p>{t(`empty.${filter}.desc`)}</p>
    </div>
  )
}

function HowItWorksFold() {
  const t = useTranslations('points')

  return (
    <details className="fold">
      <summary>
        <svg className="i" aria-hidden="true">
          <use href="#i-swap" />
        </svg>
        {t('howItWorks.title')}
        <svg className="i chev" aria-hidden="true">
          <use href="#i-chev" />
        </svg>
      </summary>
      <div className="fb">
        <ul>
          <li>{t('howItWorks.rule1')}</li>
          <li>{t('howItWorks.rule2')}</li>
          <li>{t('howItWorks.rule3')}</li>
          <li>{t('howItWorks.rule4')}</li>
          <li>{t('howItWorks.rule5')}</li>
          <li>{t('howItWorks.rule6')}</li>
        </ul>
      </div>
    </details>
  )
}

function TierBenefitsFold() {
  const t = useTranslations('points')

  return (
    <details className="fold">
      <summary>
        <svg className="i" aria-hidden="true">
          <use href="#i-gift" />
        </svg>
        {t('tierBenefits.title')}
        <svg className="i chev" aria-hidden="true">
          <use href="#i-chev" />
        </svg>
      </summary>
      <div className="fb">
        <p>{t('tierBenefits.desc')}</p>
      </div>
    </details>
  )
}

function LoadingSkeleton() {
  return (
    <div className="grid">
      <section className="col-l">
        <div className="skel sk-card" style={{ height: '330px', borderRadius: '20px' }} />
        <div className="acts" style={{ marginTop: '14px' }}>
          <div className="skel" style={{ height: '52px', borderRadius: '14px' }} />
          <div className="skel" style={{ height: '52px', borderRadius: '14px' }} />
        </div>
      </section>
      <div className="col-r">
        <div className="skel" style={{ width: '88px', height: '20px', marginBottom: '12px' }} />
        <div className="skel" style={{ height: '44px', borderRadius: '999px', marginBottom: '12px' }} />
        <div className="group">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="row">
              <div className="skel" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
              <div>
                <div className="skel" style={{ width: '110px', height: '14px' }} />
                <div className="skel" style={{ width: '170px', height: '12px', marginTop: '8px' }} />
              </div>
              <div className="skel" style={{ width: '56px', height: '16px' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ErrorView({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('points')

  return (
    <div className="grid single">
      <div className="alert" role="alert">
        <svg className="i" aria-hidden="true">
          <use href="#i-alert" />
        </svg>
        <div>
          <h3>{t('error.title')}</h3>
          <p>{t('error.desc')}</p>
          <button className="btn secondary sm" onClick={onRetry}>
            <svg className="i" aria-hidden="true">
              <use href="#i-refresh" />
            </svg>
            {t('error.retry')}
          </button>
        </div>
      </div>
    </div>
  )
}
