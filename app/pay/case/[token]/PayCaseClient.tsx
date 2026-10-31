'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type CaseStatus = 'draft' | 'notified' | 'paid' | 'overdue' | 'waived' | 'cancelled'
type View = 'idle' | 'opening' | 'checking' | 'paid' | 'review' | 'error'

const POLL_MS = 3000
const POLL_MAX = 20

export default function PayCaseClient({
  token,
  status,
  amount,
  returnedFromGateway,
}: {
  token: string
  status: CaseStatus
  amount: number
  returnedFromGateway: boolean
}) {
  const [view, setView] = useState<View>(status === 'paid' ? 'paid' : returnedFromGateway ? 'checking' : 'idle')
  const [message, setMessage] = useState('')
  const polls = useRef(0)

  const check = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/cases/${token}/status`, { cache: 'no-store' })
      const json: unknown = await res.json()
      const state = typeof json === 'object' && json !== null ? (json as Record<string, unknown>).state : null
      if (state === 'paid') {
        setView('paid')
        return true
      }
      if (state === 'needs_review') {
        setView('review')
        return true
      }
      if (state === 'closed' || state === 'none') {
        setView('idle')
        return true
      }
    } catch {
      // keep polling
    }
    return false
  }, [token])

  useEffect(() => {
    if (view !== 'checking') return
    let cancelled = false
    const tick = async () => {
      if (cancelled) return
      const done = await check()
      if (done || cancelled) return
      polls.current += 1
      if (polls.current >= POLL_MAX) {
        setView('review')
        return
      }
      setTimeout(tick, POLL_MS)
    }
    void tick()
    return () => {
      cancelled = true
    }
  }, [view, check])

  const pay = async () => {
    setView('opening')
    setMessage('')
    try {
      const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      const res = await fetch(`/api/cases/${token}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: mobile ? 'h5' : 'web' }),
      })
      const json: unknown = await res.json()
      const rec = typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : {}
      if (res.ok && typeof rec.payUrl === 'string') {
        window.location.href = rec.payUrl
        return
      }
      setMessage(typeof rec.error === 'string' ? rec.error : '未能開啟付款，請稍後再試')
      setView('error')
    } catch {
      setMessage('網絡出現問題，請稍後再試')
      setView('error')
    }
  }

  if (view === 'paid') {
    return (
      <div className="rounded-xl border border-[#22c55e]/40 bg-[#22c55e]/10 p-4 text-center">
        <p className="font-medium text-[#22c55e]">已收到繳付</p>
        <p className="mt-1 text-sm text-white/60">個案已結案，我們已發送確認電郵給你。</p>
      </div>
    )
  }
  if (status === 'waived' || status === 'cancelled') {
    return <p className="text-center text-sm text-white/60">此個案已結案，毋須繳付。</p>
  }
  if (view === 'checking') {
    return <p className="text-center text-sm text-white/70">正在確認你的付款，請勿關閉此頁…</p>
  }
  if (view === 'review') {
    return (
      <div className="rounded-xl border border-white/15 p-4 text-center">
        <p className="font-medium">付款確認中</p>
        <p className="mt-1 text-sm text-white/60">如你已完成付款，我們核實後會電郵通知你，毋須重複繳付。</p>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={pay}
        disabled={view === 'opening'}
        className="w-full rounded-xl bg-[#22c55e] px-5 py-3.5 text-base font-semibold text-black transition active:scale-[0.99] disabled:opacity-60"
      >
        {view === 'opening' ? '正在前往 KPay…' : `前往 KPay 繳付 HK$${amount.toLocaleString('en-US')}`}
      </button>
      {view === 'error' && <p role="alert" className="mt-3 text-center text-sm text-red-400">{message}</p>}
      <p className="mt-3 text-center text-xs text-white/40">付款頁由 KPay 提供，資料加密傳輸。</p>
    </div>
  )
}
