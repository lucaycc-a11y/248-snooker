'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type LedgerEntry = {
  id: string
  type: 'booking_usage' | 'booking_earn' | 'manual_credit' | 'refund' | 'adjustment'
  amount: number
  balance_after: number
  created_at: string
  reference: string | null
  description: string | null
}

const INK = '#ffffff'
const SUBTLE = '#A1A1A6'
const BORDER = 'rgba(255,255,255,0.1)'
const GLASS_BG = 'rgba(255,255,255,0.05)'
const GREEN = '#22C55E'
const DANGER = '#FF453A'
const SPRING = { type: 'spring', stiffness: 320, damping: 30 } as const

export default function WalletPage() {
  const t = useTranslations()
  const router = useRouter()
  const supabase = createClient()

  const [balance, setBalance] = useState<number | null>(null)
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchWalletData = async () => {
      try {
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
          router.push('/auth')
          return
        }

        // Fetch wallet balance and ledger
        const resp = await fetch('/api/member/wallet/ledger')
        if (!resp.ok) throw new Error('Failed to fetch wallet data')
        const data = await resp.json()

        if (data.balance !== undefined) {
          setBalance(data.balance)
        }
        if (data.ledger) {
          setLedger(data.ledger)
        }
      } catch (err) {
        console.error('Wallet fetch error:', err)
        setError('Unable to load wallet data')
      } finally {
        setLoading(false)
      }
    }

    fetchWalletData()
  }, [supabase, router])

  const formatCurrency = (amount: number) => `HK$${amount.toFixed(0)}`

  const getTypeLabel = (type: string) => {
    const key = `wallet.type.${type}` as const
    return t(key) || type
  }

  const getTypeIcon = (type: string, amount: number) => {
    if (amount > 0) {
      return <TrendingUp size={16} style={{ color: GREEN }} />
    }
    return <TrendingDown size={16} style={{ color: DANGER }} />
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Intl.DateTimeFormat('zh-HK', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(dateStr))
    } catch {
      return dateStr
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000' }}>
      {/* Header */}
      <div style={{
        padding: '20px',
        borderBottom: `1px solid ${BORDER}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <button
          onClick={() => router.back()}
          style={{
            background: 'none',
            border: 'none',
            color: INK,
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <h1 style={{
          fontSize: 18,
          fontWeight: 600,
          color: INK,
          margin: 0,
        }}>
          {t('wallet.title')}
        </h1>
      </div>

      {/* Balance Card */}
      {loading ? (
        <div style={{ padding: 20, textAlign: 'center', color: SUBTLE }}>
          {t('loading')}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
        >
          <div style={{
            margin: '20px',
            padding: '24px',
            background: GLASS_BG,
            backdropFilter: 'blur(20px)',
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
          }}>
            <div style={{
              fontSize: 12,
              color: SUBTLE,
              marginBottom: 8,
            }}>
              {t('wallet.balance_label')}
            </div>
            <div style={{
              fontSize: 32,
              fontWeight: 700,
              color: GREEN,
              margin: 0,
            }}>
              {balance !== null ? formatCurrency(balance) : '—'}
            </div>
          </div>

          {/* Ledger */}
          <div style={{ padding: '20px' }}>
            <h2 style={{
              fontSize: 16,
              fontWeight: 600,
              color: INK,
              marginBottom: 16,
              margin: '0 0 16px',
            }}>
              {t('wallet.transactions_label')}
            </h2>

            {ledger.length === 0 ? (
              <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: SUBTLE,
              }}>
                {t('wallet.empty_state')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ledger.map((entry, idx) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...SPRING, delay: idx * 0.05 }}
                    style={{
                      padding: '12px',
                      background: GLASS_BG,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                      {getTypeIcon(entry.type, entry.amount)}
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: INK,
                        }}>
                          {getTypeLabel(entry.type)}
                        </div>
                        <div style={{
                          fontSize: 11,
                          color: SUBTLE,
                          marginTop: 2,
                        }}>
                          {formatDate(entry.created_at)}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: entry.amount > 0 ? GREEN : INK,
                      }}>
                        {entry.amount > 0 ? '+' : ''}{formatCurrency(entry.amount)}
                      </div>
                      <div style={{
                        fontSize: 11,
                        color: SUBTLE,
                        marginTop: 2,
                      }}>
                        {formatCurrency(entry.balance_after)}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {error && (
        <div style={{
          padding: 20,
          margin: '20px',
          background: 'rgba(255, 69, 58, 0.1)',
          border: `1px solid ${DANGER}`,
          borderRadius: 8,
          color: DANGER,
          fontSize: 13,
        }}>
          {error}
        </div>
      )}
    </div>
  )
}
