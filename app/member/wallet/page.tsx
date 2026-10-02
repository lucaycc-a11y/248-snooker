'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'

type TabType = 'all' | 'use' | 'in' | 'offers'
type StateType = 'normal' | 'held' | 'new' | 'loading' | 'error'

interface LedgerEntry {
  id: string
  type: 'convert' | 'signup' | 'topup' | 'redeem' | 'refund' | 'reversal' | 'manual'
  amount: number
  balance_after: number
  created_at: string
  reference_id?: string
  note?: string
}

interface PromoCode {
  code: string
  discount_type: string
  discount_value: number
  min_order_cents: number
  expiry: string | null
}

interface UsedCode {
  code: string
  usedAt: string
}

interface OffersResponse {
  eligible: PromoCode[]
  used: UsedCode[]
}

const SPRING = { type: 'spring', stiffness: 320, damping: 30 } as const

const typeConfig: Record<LedgerEntry['type'], { label: string; icon: string; tab: 'all' | 'use' | 'in' }> = {
  convert: { label: 'wallet.type.convert', icon: 'swap', tab: 'in' },
  signup: { label: 'wallet.type.signup', icon: 'gift', tab: 'in' },
  topup: { label: 'wallet.type.topup', icon: 'plus', tab: 'in' },
  refund: { label: 'wallet.type.refund', icon: 'return', tab: 'in' },
  manual: { label: 'wallet.type.manual', icon: 'sliders', tab: 'in' },
  redeem: { label: 'wallet.type.redeem', icon: 'cal', tab: 'use' },
  reversal: { label: 'wallet.type.reversal', icon: 'minus', tab: 'use' },
}

export default function WalletPage() {
  const t = useTranslations()
  const router = useRouter()
  const supabase = createClient()

  const [state, setState] = useState<StateType>('loading')
  const [tab, setTab] = useState<TabType>('all')
  const [balance, setBalance] = useState<number>(0)
  const [held, setHeld] = useState<number>(0)
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [offers, setOffers] = useState<OffersResponse | null>(null)
  const [toastMessage, setToastMessage] = useState<string>('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
          router.push('/auth')
          return
        }

        const [walletRes, ledgerRes, offersRes] = await Promise.all([
          fetch('/api/member/wallet'),
          fetch('/api/member/wallet/ledger'),
          fetch('/api/member/wallet/offers'),
        ])

        if (!walletRes.ok || !ledgerRes.ok || !offersRes.ok) {
          setState('error')
          return
        }

        const walletData = await walletRes.json()
        const ledgerData = await ledgerRes.json()
        const offersData = await offersRes.json()

        setBalance(walletData.balance ?? 0)
        setHeld(walletData.held ?? 0)
        setLedger(ledgerData.ledger ?? [])
        setOffers(offersData)

        if ((walletData.balance ?? 0) === 0 && (ledgerData.ledger ?? []).length === 0) {
          setState('new')
        } else if ((walletData.held ?? 0) > 0) {
          setState('held')
        } else {
          setState('normal')
        }
      } catch (err) {
        console.error('[wallet] fetch error:', err)
        setState('error')
      }
    }

    fetchData()
  }, [supabase, router])

  const handleRetry = () => {
    setState('loading')
    window.location.reload()
  }

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code).catch(() => {})
    setToastMessage(`已複製優惠碼 ${code}`)
    setTimeout(() => setToastMessage(''), 1800)
  }

  const formatCurrency = (amount: number) => `HK$${Math.round(amount)}`
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      const m = d.getMonth() + 1
      const day = d.getDate()
      return `${m}月${day}日`
    } catch {
      return dateStr
    }
  }

  const groupByMonth = (entries: LedgerEntry[]) => {
    const months: Record<string, LedgerEntry[]> = {}
    entries.forEach((e) => {
      const k = e.created_at.slice(0, 7)
      if (!months[k]) months[k] = []
      months[k].push(e)
    })
    return Object.keys(months)
      .sort()
      .reverse()
      .map((k) => ({ month: k, entries: months[k] }))
  }

  const filteredLedger = ledger.filter((e) => tab === 'all' || typeConfig[e.type].tab === tab)

  return (
    <div className="app wide">
      <header className="top">
        <button className="icon-btn" onClick={() => router.back()} aria-label="返回">
          <svg className="i" aria-hidden="true">
            <use href="#i-back" />
          </svg>
        </button>
        <h1 className="t gt">{t('wallet.title')}</h1>
        <span></span>
      </header>

      {state === 'error' && (
        <div style={{ maxWidth: '520px', margin: '0 auto', padding: '20px' }}>
          <div className="alert" role="alert">
            <svg className="i" aria-hidden="true">
              <use href="#i-alert" />
            </svg>
            <div>
              <h3>暫時未能載入 Space Wallet</h3>
              <p>你的餘額不受影響。請檢查網絡後重試，如仍然失敗，請聯絡我們。</p>
              <button className="btn secondary sm" onClick={handleRetry}>
                <svg className="i" aria-hidden="true">
                  <use href="#i-refresh" />
                </svg>
                重試
              </button>
            </div>
          </div>
        </div>
      )}

      {state !== 'error' && (
        <div className="grid" id="grid">
          <section id="hero" className="col-l" aria-live="polite">
            {state === 'loading' && <div className="skel sk-card" />}

            {(state === 'normal' || state === 'held' || state === 'new') && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}>
                <div className="wcard">
                  <div className="wc-top">
                    <span className="gt wc-code">SPACE8-K7QD-4M2X</span>
                    {state === 'held' && held > 0 && (
                      <span className="wc-held">
                        {t('wallet.reserved')} <span className="gt">{formatCurrency(held)}</span>
                      </span>
                    )}
                  </div>
                  <div className="wc-mid">
                    <p className="wc-label">{t('wallet.balance_label')}</p>
                    <p className="wc-bal gt" aria-label={`${t('wallet.balance_label')} ${balance} 港元`}>
                      <span className="cur">HK$</span>
                      <span id="balNum">{Math.round(balance)}</span>
                    </p>
                    <p className="wc-note">1 元 = HK$1，付款時可直接抵扣預約費用</p>
                  </div>
                  <span className="wc-bot"></span>
                  <span className="wc-mark gt" aria-hidden="true">8</span>
                </div>
              </motion.div>
            )}

            <div className="acts" id="acts">
              <a className="btn primary" href="/booking">立即預訂</a>
              <a className="btn secondary" href="/member/points">查看積分</a>
            </div>
          </section>

          <div id="listArea" className="col-r">
            <div className="sticky">
              <div className="tabs" role="tablist" aria-label="Space Wallet 紀錄">
                {(['all', 'use', 'in', 'offers'] as const).map((t_) => (
                  <button
                    key={t_}
                    className="tab"
                    role="tab"
                    aria-selected={tab === t_}
                    onClick={() => setTab(t_)}
                    onKeyDown={(e) => {
                      const tabs = Array.from(document.querySelectorAll('.tab'))
                      const idx = tabs.indexOf(e.currentTarget as HTMLElement)
                      if (e.key === 'ArrowRight') (tabs[(idx + 1) % tabs.length] as HTMLButtonElement).focus()
                      if (e.key === 'ArrowLeft') (tabs[(idx - 1 + tabs.length) % tabs.length] as HTMLButtonElement).focus()
                    }}
                  >
                    {t(`wallet.tab_${t_}`)}
                  </button>
                ))}
              </div>
            </div>

            <div id="panel" role="tabpanel">
              {state === 'loading' && (
                <div>
                  <div className="month">
                    <div className="skel" style={{ width: '88px', height: '14px' }} />
                  </div>
                  <div className="group">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="row">
                        <div className="skel" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                        <div>
                          <div className="skel" style={{ width: '96px', height: '14px' }} />
                          <div className="skel" style={{ width: '160px', height: '12px', marginTop: '8px' }} />
                        </div>
                        <div className="skel" style={{ width: '64px', height: '16px' }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === 'offers' && offers && (
                <div>
                  <div className="rule">
                    <svg className="i" aria-hidden="true">
                      <use href="#i-lock" />
                    </svg>
                    <span>使用優惠碼時，無法同時使用 Space Wallet，結帳時只可選擇其中一種。</span>
                  </div>
                  <h2 className="sec">{t('wallet.offers_eligible')}</h2>
                  {offers.eligible.length === 0 ? (
                    <div className="empty">
                      <div className="ic">
                        <svg className="i" aria-hidden="true">
                          <use href="#i-wallet" />
                        </svg>
                      </div>
                      <h3>暫時未有可用優惠</h3>
                      <p>有新優惠時，我們會寄到你的收件箱。</p>
                    </div>
                  ) : (
                    offers.eligible.map((o) => (
                      <div key={o.code} className="offer">
                        <div>
                          <h4>{o.code}</h4>
                          <p className="gt">{formatCurrency(o.discount_value)}</p>
                        </div>
                        <button className="codebtn" onClick={() => copyCode(o.code)} aria-label={`複製優惠碼 ${o.code}`}>
                          {o.code}
                          <svg className="i" aria-hidden="true">
                            <use href="#i-copy" />
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                  {offers.used.length > 0 && (
                    <>
                      <h2 className="sec">{t('wallet.offers_used')}</h2>
                      <div className="group">
                        {offers.used.map((u) => (
                          <div key={u.code} className="row">
                            <span className="ic">
                              <svg className="i" aria-hidden="true">
                                <use href="#i-tag" />
                              </svg>
                            </span>
                            <div>
                              <div className="r-t">{u.code}</div>
                              <div className="r-s">{formatDate(u.usedAt)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {tab !== 'offers' && state !== 'loading' && (
                <>
                  {filteredLedger.length === 0 ? (
                    <div className="empty">
                      <div className="ic">
                        <svg className="i" aria-hidden="true">
                          <use href="#i-wallet" />
                        </svg>
                      </div>
                      <h3>
                        {tab === 'all' && '未有紀錄'}
                        {tab === 'use' && '未有使用紀錄'}
                        {tab === 'in' && '未有入帳紀錄'}
                      </h3>
                      <p>
                        {tab === 'all' && '完成預約後，積分會自動存入錢包，之後每次付款都可以直接抵扣。'}
                        {tab === 'use' && '在結帳時選擇「套用」，就可以用 Space Wallet 付款。'}
                        {tab === 'in' && '每累積 100 積分，會自動存入 HK$10。'}
                      </p>
                    </div>
                  ) : (
                    groupByMonth(filteredLedger).map((group) => (
                      <div key={group.month}>
                        <div className="month">
                          {group.month.slice(0, 4)}年{parseInt(group.month.slice(5), 10)}月
                        </div>
                        <div className="group">
                          {group.entries.map((entry, idx) => {
                            const cfg = typeConfig[entry.type]
                            const pos = entry.amount > 0
                            const al = `${pos ? '增加 ' : '扣除 '}${Math.abs(entry.amount)} 港元，餘額 ${entry.balance_after} 港元`
                            return (
                              <motion.div
                                key={entry.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ ...SPRING, delay: idx * 0.02 }}
                              >
                                <div className="row">
                                  <span className={`ic ${pos ? 'pos' : ''}`}>
                                    <svg className="i" aria-hidden="true">
                                      <use href={`#i-${cfg.icon}`} />
                                    </svg>
                                  </span>
                                  <div>
                                    <div className="r-t">{t(cfg.label)}</div>
                                    <div className="r-s">{formatDate(entry.created_at)}</div>
                                    {entry.note && <div className="r-s r-d">{entry.note}</div>}
                                  </div>
                                  <div className="amt" aria-label={al}>
                                    <b className={pos ? 'pos' : ''}>
                                      {pos ? '+' : '-'}HK${Math.abs(entry.amount)}
                                    </b>
                                    <small>
                                      餘額 <span className="gt">HK${entry.balance_after}</span>
                                    </small>
                                  </div>
                                </div>
                              </motion.div>
                            )
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>

            <details className="fold">
              <summary>
                <svg className="i" aria-hidden="true">
                  <use href="#i-wallet" />
                </svg>
                Space Wallet {t('wallet.how_it_works')}
                <svg className="i chev" aria-hidden="true">
                  <use href="#i-chev" />
                </svg>
              </summary>
              <div className="fb">
                <ul>
                  <li>每消費 HK$1 累積 1 積分，以實付金額計算。</li>
                  <li>每累積 100 積分，自動存入 HK$10 至 Space Wallet，無需任何操作。</li>
                  <li>當次消費所得積分於付款成功後入帳，不可用於本次訂單。</li>
                  <li>優惠碼與 Space Wallet 只能擇一使用。</li>
                  <li>訂單退款時，已使用的金額會全數退回 Space Wallet。</li>
                </ul>
              </div>
            </details>
          </div>
        </div>
      )}

      <div className="toast" id="toast" style={{ opacity: toastMessage ? 1 : 0, pointerEvents: toastMessage ? 'auto' : 'none' }} role="status">
        {toastMessage}
      </div>

      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <symbol id="i-back" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></symbol>
          <symbol id="i-chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></symbol>
          <symbol id="i-wallet" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1H6a1 1 0 0 0 0 2h14v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M16.5 14.5h.01" /></symbol>
          <symbol id="i-alert" viewBox="0 0 24 24"><path d="M12 8v5M12 16.5h.01" /><path d="M10.3 3.9L2.4 17.5a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></symbol>
          <symbol id="i-refresh" viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3" /><path d="M5 4v4h4M19 20v-4h-4" /></symbol>
          <symbol id="i-copy" viewBox="0 0 24 24"><path d="M9 9h11v11H9z" /><path d="M5 15V4h10" /></symbol>
          <symbol id="i-tag" viewBox="0 0 24 24"><path d="M3 12V4h8l10 10-8 8z" /><path d="M7.5 8.5h.01" /></symbol>
          <symbol id="i-lock" viewBox="0 0 24 24"><path d="M6 11h12v9H6z" /><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" /></symbol>
          <symbol id="i-swap" viewBox="0 0 24 24"><path d="M7 7h12l-3-3M17 17H5l3 3" /></symbol>
          <symbol id="i-gift" viewBox="0 0 24 24"><path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13" /><path d="M12 7c-2.5 0-4-1-4-2.5S9.5 2.5 12 5c2.5-2.5 4-.5 4 .5S14.5 7 12 7z" /></symbol>
          <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></symbol>
          <symbol id="i-return" viewBox="0 0 24 24"><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></symbol>
          <symbol id="i-sliders" viewBox="0 0 24 24"><path d="M4 6h8M16 6h4M4 12h2M10 12h10M4 18h10M18 18h2" /><path d="M14 4v4M8 10v4M16 16v4" /></symbol>
          <symbol id="i-cal" viewBox="0 0 24 24"><path d="M7 3v3M17 3v3M4 9h16" /><path d="M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" /></symbol>
          <symbol id="i-minus" viewBox="0 0 24 24"><path d="M5 12h14" /></symbol>
        </defs>
      </svg>
    </div>
  )
}
