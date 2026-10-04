'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type {
  WalletBalance,
  WalletLedgerItem,
  WalletOffersResponse,
  OfferAvailable,
  OfferUsed,
} from '@/lib/member-contracts'
import { formatHkd, roomName, formatDayMonth, formatTimeRange, parseConvertNote } from '@/lib/member-format'
import '../member-ui.css'

type TabKey = 'all' | 'use' | 'in' | 'offer'

type LoadState = 'loading' | 'loaded' | 'error'

export default function WalletPage() {
  const t = useTranslations('wallet')
  const router = useRouter()

  // Balance state
  const [balance, setBalance] = useState<WalletBalance | null>(null)
  const [balanceState, setBalanceState] = useState<LoadState>('loading')

  // Ledger state
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [ledgerItems, setLedgerItems] = useState<WalletLedgerItem[]>([])
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Offers state
  const [offers, setOffers] = useState<WalletOffersResponse | null>(null)
  const [offersLoading, setOffersLoading] = useState(false)

  // Infinite scroll
  const observerTarget = useRef<HTMLDivElement>(null)

  // Fetch balance
  const fetchBalance = useCallback(async () => {
    try {
      setBalanceState('loading')
      const res = await fetch('/api/member/wallet')
      if (!res.ok) {
        setBalanceState('error')
        return
      }
      const data = await res.json()
      setBalance(data.balance)
      setLedgerItems(data.ledger.items)
      setHasMore(data.ledger.hasMore)
      setNextCursor(data.ledger.nextCursor)
      setBalanceState('loaded')
    } catch {
      setBalanceState('error')
    }
  }, [])

  // Fetch ledger page
  const fetchLedger = useCallback(
    async (tab: TabKey, cursor: string | null = null) => {
      if (tab === 'offer') return

      setLedgerLoading(true)
      try {
        const params = new URLSearchParams()
        if (tab !== 'all') params.set('filter', tab)
        if (cursor) params.set('cursor', cursor)

        const res = await fetch(`/api/member/wallet?${params}`)
        if (!res.ok) return

        const data = await res.json()
        if (cursor) {
          setLedgerItems((prev) => [...prev, ...data.ledger.items])
        } else {
          setLedgerItems(data.ledger.items)
        }
        setHasMore(data.ledger.hasMore)
        setNextCursor(data.ledger.nextCursor)
      } finally {
        setLedgerLoading(false)
      }
    },
    []
  )

  // Fetch offers
  const fetchOffers = useCallback(async () => {
    setOffersLoading(true)
    try {
      const res = await fetch('/api/member/wallet/offers')
      if (!res.ok) return
      const data: WalletOffersResponse = await res.json()
      setOffers(data)
    } finally {
      setOffersLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  // Tab change
  const handleTabChange = useCallback(
    (tab: TabKey) => {
      setActiveTab(tab)
      setExpandedId(null)
      if (tab === 'offer') {
        fetchOffers()
      } else {
        fetchLedger(tab)
      }
    },
    [fetchLedger, fetchOffers]
  )

  // Infinite scroll observer
  useEffect(() => {
    if (!hasMore || ledgerLoading || activeTab === 'offer') return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextCursor) {
          fetchLedger(activeTab, nextCursor)
        }
      },
      { threshold: 0.5 }
    )

    const target = observerTarget.current
    if (target) observer.observe(target)

    return () => {
      if (target) observer.unobserve(target)
    }
  }, [hasMore, ledgerLoading, nextCursor, activeTab, fetchLedger])

  // Filter ledger by tab
  const visibleItems = ledgerItems.filter((item) => {
    if (activeTab === 'all') return true
    if (activeTab === 'use') return item.amount < 0
    if (activeTab === 'in') return item.amount > 0
    return false
  })

  // Group ledger by month
  const groupedByMonth = visibleItems.reduce((acc, item) => {
    const date = new Date(item.createdAt)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    if (!acc[monthKey]) {
      acc[monthKey] = []
    }
    acc[monthKey].push(item)
    return acc
  }, {} as Record<string, WalletLedgerItem[]>)

  const monthKeys = Object.keys(groupedByMonth).sort((a, b) => b.localeCompare(a))

  // Month heading formatter
  const formatMonthHeading = (monthKey: string): string => {
    const [year, month] = monthKey.split('-')
    const date = new Date(Number(year), Number(month) - 1, 1)
    return date.toLocaleDateString('zh-HK', { year: 'numeric', month: 'long' })
  }

  // Ledger row icon
  const getIcon = (type: string): string => {
    const icons: Record<string, string> = {
      convert: 'swap',
      signup: 'gift',
      topup: 'plus',
      refund: 'return',
      manual: 'sliders',
      redeem: 'cal',
      reversal: 'minus',
    }
    return icons[type] || 'wallet'
  }

  // Ledger row title
  const getTitle = (item: WalletLedgerItem): string => {
    const titles: Record<string, string> = {
      convert: t('type_convert'),
      signup: t('type_signup'),
      topup: t('type_topup'),
      refund: t('type_refund'),
      manual: t('type_manual'),
      redeem: t('type_redeem'),
      reversal: t('type_reversal'),
    }
    return titles[item.type] || item.type
  }

  // Ledger row subtitle
  const getSubtitle = (item: WalletLedgerItem): string => {
    if (item.type === 'convert' && item.pointsConverted) {
      return t('convert_subtitle', { points: item.pointsConverted })
    }
    if (item.booking) {
      return `${roomName(item.booking.tableNumber)} · ${formatDayMonth(item.booking.date)}`
    }
    return formatDayMonth(item.createdAt)
  }

  return (
    <div className="m8 m8-wallet">
      <main className="app wide">
        <div className="top">
        <button className="icon-btn" onClick={() => router.back()} aria-label={t('back')}>
          <svg className="i" aria-hidden="true">
            <use href="#i-back" />
          </svg>
        </button>
        <h1 className="t gt">Space Wallet</h1>
        <span />
      </div>

      <div className={balanceState === 'error' ? 'grid single' : 'grid'}>
        {/* Left column: Balance card */}
        <section className="col-l" aria-live="polite">
          {balanceState === 'loading' && <div className="skel sk-card" />}

          {balanceState === 'error' && (
            <div className="alert" role="alert">
              <svg className="i" aria-hidden="true">
                <use href="#i-alert" />
              </svg>
              <div>
                <h3>{t('error_title')}</h3>
                <p>{t('error_message')}</p>
                <button className="btn secondary sm" onClick={fetchBalance}>
                  <svg className="i" aria-hidden="true">
                    <use href="#i-refresh" />
                  </svg>
                  {t('retry')}
                </button>
              </div>
            </div>
          )}

          {balanceState === 'loaded' && balance && (
            <>
              <div className="wcard">
                <div className="wc-top">
                  <span className="gt wc-code">{balance.memberCode}</span>
                  {balance.held > 0 && (
                    <span className="wc-held">
                      {t('held_label')} <span className="gt">{formatHkd(balance.held)}</span>
                    </span>
                  )}
                </div>
                <div className="wc-mid">
                  <p className="wc-label">{t('balance_label')}</p>
                  <p className="wc-bal gt" aria-label={t('balance_aria', { amount: balance.available })}>
                    <span className="cur">HK$</span>
                    <span>{balance.available.toLocaleString('en-HK')}</span>
                  </p>
                  <p className="wc-note">{t('balance_note')}</p>
                </div>
                <span className="wc-bot" />
                <span className="wc-mark gt" aria-hidden="true">
                  8
                </span>
              </div>

              <div className="acts">
                <a className="btn primary" href="/member/booking">
                  {t('book_now')}
                </a>
                <a className="btn secondary" href="/member/points">
                  {t('view_points')}
                </a>
              </div>
            </>
          )}
        </section>

        {/* Right column: Tabs and ledger */}
        {balanceState === 'loaded' && (
          <div className="col-r">
            <div className="sticky">
              <div className="tabs" role="tablist" aria-label={t('tabs_label')}>
                {(['all', 'use', 'in', 'offer'] as const).map((tab) => (
                  <button
                    key={tab}
                    className="tab"
                    role="tab"
                    aria-selected={activeTab === tab}
                    onClick={() => handleTabChange(tab)}
                  >
                    {t(`tab_${tab}`)}
                  </button>
                ))}
              </div>
            </div>

            <div role="tabpanel">
              {/* Ledger tabs */}
              {activeTab !== 'offer' && (
                <>
                  {visibleItems.length === 0 && !ledgerLoading && (
                    <div className="empty">
                      <div className="ic">
                        <svg className="i" aria-hidden="true">
                          <use href="#i-history" />
                        </svg>
                      </div>
                      <h3>{t('empty_title')}</h3>
                      <p>{t('empty_message')}</p>
                      <a className="btn primary" href="/member/booking">
                        {t('book_now')}
                      </a>
                    </div>
                  )}

                  {visibleItems.length > 0 && (
                    <>
                      {monthKeys.map((monthKey) => (
                        <div key={monthKey}>
                          <div className="month">{formatMonthHeading(monthKey)}</div>
                          <div className="group">
                            {groupedByMonth[monthKey].map((item) => (
                              <div key={item.id}>
                                <button
                                  className="row"
                                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                                  style={{ width: '100%', cursor: item.booking ? 'pointer' : 'default' }}
                                >
                                  <div className={`ic ${item.amount > 0 ? 'pos' : ''}`}>
                                    <svg className="i" aria-hidden="true">
                                      <use href={`#i-${getIcon(item.type)}`} />
                                    </svg>
                                  </div>
                                  <div>
                                    <div className="r-t">{getTitle(item)}</div>
                                    <div className="r-s">{getSubtitle(item)}</div>
                                  </div>
                                  <div className="amt">
                                    <b className={item.amount > 0 ? 'pos' : ''}>
                                      {item.amount > 0 ? '+' : ''}
                                      {formatHkd(Math.abs(item.amount))}
                                    </b>
                                    <small>
                                      {t('balance_after')} <span className="gt">{formatHkd(item.balanceAfter)}</span>
                                    </small>
                                  </div>
                                </button>

                                {expandedId === item.id && item.booking && (
                                  <div className="det" style={{ padding: '0 16px 16px', fontSize: '13px', color: 'var(--muted)' }}>
                                    <div style={{ marginBottom: '6px' }}>
                                      <strong style={{ color: 'var(--text)' }}>{t('booking_reference')}</strong> {item.booking.humanCode}
                                    </div>
                                    <div>{formatTimeRange(item.booking.startTime, item.booking.endTime)}</div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {hasMore && <div ref={observerTarget} style={{ height: '20px', margin: '16px 0' }} />}
                  {ledgerLoading && (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--faint)' }}>{t('loading')}</div>
                  )}
                </>
              )}

              {/* Offers tab */}
              {activeTab === 'offer' && (
                <>
                  {offersLoading && (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--faint)' }}>{t('loading')}</div>
                  )}

                  {!offersLoading && offers && (
                    <>
                      {offers.available.length > 0 && (
                        <>
                          <div className="sec">{t('offers_available')}</div>
                          {offers.available.map((offer) => (
                            <div key={offer.code} className="offer">
                              <div>
                                <h4>{offer.name}</h4>
                                <p>
                                  {offer.discountType === 'percentage'
                                    ? t('offer_discount_pct', { value: offer.discountValue })
                                    : t('offer_discount_fixed', { value: offer.discountValue })}
                                </p>
                              </div>
                              <button className="codebtn">{offer.code}</button>
                            </div>
                          ))}
                        </>
                      )}

                      {offers.used.length > 0 && (
                        <>
                          <div className="sec">{t('offers_used')}</div>
                          {offers.used.map((offer) => (
                            <div key={`${offer.code}-${offer.redeemedAt}`} className="offer">
                              <div>
                                <h4>{offer.name}</h4>
                                <p>
                                  {t('offer_used_date', { date: formatDayMonth(offer.redeemedAt) })} · {t('offer_saved')}{' '}
                                  {formatHkd(offer.discountAmount)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </>
                      )}

                      {offers.available.length === 0 && offers.used.length === 0 && (
                        <div className="empty">
                          <div className="ic">
                            <svg className="i" aria-hidden="true">
                              <use href="#i-tag" />
                            </svg>
                          </div>
                          <h3>{t('offers_empty_title')}</h3>
                          <p>{t('offers_empty_message')}</p>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            {/* FAQ */}
            <details className="fold">
              <summary>
                <svg className="i" aria-hidden="true">
                  <use href="#i-wallet" />
                </svg>
                {t('faq_title')}
                <svg className="i chev" aria-hidden="true">
                  <use href="#i-chev" />
                </svg>
              </summary>
              <div className="fb">
                <ul>
                  <li>{t('faq_1')}</li>
                  <li>{t('faq_2')}</li>
                  <li>{t('faq_3')}</li>
                  <li>{t('faq_4')}</li>
                  <li>{t('faq_5')}</li>
                </ul>
              </div>
            </details>
          </div>
        )}
      </div>

      {/* SVG sprite */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <symbol id="i-back" viewBox="0 0 24 24">
            <path d="M15 5l-7 7 7 7" />
          </symbol>
          <symbol id="i-chev" viewBox="0 0 24 24">
            <path d="M6 9l6 6 6-6" />
          </symbol>
          <symbol id="i-wallet" viewBox="0 0 24 24">
            <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1H6a1 1 0 0 0 0 2h14v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <path d="M16.5 14.5h.01" />
          </symbol>
          <symbol id="i-alert" viewBox="0 0 24 24">
            <path d="M12 8v5M12 16.5h.01" />
            <path d="M10.3 3.9L2.4 17.5a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          </symbol>
          <symbol id="i-refresh" viewBox="0 0 24 24">
            <path d="M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3" />
            <path d="M5 4v4h4M19 20v-4h-4" />
          </symbol>
          <symbol id="i-history" viewBox="0 0 24 24">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5M12 7v5l3 2" />
          </symbol>
          <symbol id="i-swap" viewBox="0 0 24 24">
            <path d="M7 7h12l-3-3M17 17H5l3 3" />
          </symbol>
          <symbol id="i-gift" viewBox="0 0 24 24">
            <path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13" />
            <path d="M12 7c-2.5 0-4-1-4-2.5S9.5 2.5 12 5c2.5-2.5 4-.5 4 .5S14.5 7 12 7z" />
          </symbol>
          <symbol id="i-plus" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" />
          </symbol>
          <symbol id="i-return" viewBox="0 0 24 24">
            <path d="M9 14L4 9l5-5" />
            <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
          </symbol>
          <symbol id="i-sliders" viewBox="0 0 24 24">
            <path d="M4 6h8M16 6h4M4 12h2M10 12h10M4 18h10M18 18h2" />
            <path d="M14 4v4M8 10v4M16 16v4" />
          </symbol>
          <symbol id="i-cal" viewBox="0 0 24 24">
            <path d="M7 3v3M17 3v3M4 9h16" />
            <path d="M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
          </symbol>
          <symbol id="i-minus" viewBox="0 0 24 24">
            <path d="M5 12h14" />
          </symbol>
          <symbol id="i-tag" viewBox="0 0 24 24">
            <path d="M3 12V4h8l10 10-8 8z" />
            <path d="M7.5 8.5h.01" />
          </symbol>
        </defs>
      </svg>
      </main>
    </div>
  )
}
