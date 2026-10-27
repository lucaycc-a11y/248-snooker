'use client'

/**
 * AiAssistantPanel — 問 AI. The admin types a question; the AI decides what to look up with
 * read-only tools and answers, showing exactly what it checked. It cannot change anything.
 */

import { useState } from 'react'
import { CheckCircle2, Sparkles, XCircle } from 'lucide-react'
import AiText from './AiText'

type Step = { tool: string; args: string; ok: boolean; preview: string; ms: number }
type Answer = { answer: string | null; steps: Step[]; model: string | null; rounds: number; error: string | null; auditError: string | null }

const TOOL_LABEL: Record<string, string> = {
  get_booking: '查預約',
  search_bookings: '搜尋預約',
  get_payment_attempts: '查付款嘗試',
  get_webhook_events: '查 KPay 通知',
  get_recent_errors: '查網站錯誤',
  get_revenue_summary: '查收入',
  run_revenue_check: '執行收入核對',
  get_user_payment_history: '查客人付款記錄',
  get_slot_occupancy: '查時段佔用',
  get_member_stats: '查會員總覽',
  search_members: '搜尋會員',
}

const PAYMENT_EXAMPLES = ['今日有沒有客人付款失敗？原因是什麼？', '最近 24 小時 PayMe 付款有沒有問題？', '本月收入和預約數有沒有對不上？', '最近有沒有客人付了款但預約未確認？']

function isAnswer(v: unknown): v is Answer {
  return typeof v === 'object' && v !== null && 'steps' in v
}

type PanelProps = {
  /** 'members' answers about members (member tools only); default is payments. */
  scope?: 'payments' | 'members'
  title?: string
  hint?: string
  placeholder?: string
  examples?: string[]
  /** Member code → member id, so codes in the answer can open that member. */
  resolveMember?: (code: string) => string | null
  onOpenMember?: (id: string) => void
}

export default function AiAssistantPanel({
  scope = 'payments',
  title = '問 AI',
  hint = '只讀：AI 會自己決定查什麼，不會修改任何資料',
  placeholder = '例：S8-1042 為什麼付了款還未確認？',
  examples = PAYMENT_EXAMPLES,
  resolveMember,
  onOpenMember,
}: PanelProps = {}) {
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [out, setOut] = useState<Answer | null>(null)

  const ask = async (q: string) => {
    const text = q.trim()
    if (text.length < 2 || busy) return
    setBusy(true)
    setError(null)
    setOut(null)
    try {
      const res = await fetch('/api/admin/ai-investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, scope }),
      })
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        setError(typeof body === 'object' && body !== null && 'error' in body ? String((body as { error: unknown }).error) : '查詢失敗')
        return
      }
      if (isAnswer(body)) setOut(body)
      else setError('回應格式不正確')
    } catch {
      setError('網絡錯誤，請稍後再試')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="admin-card rc-run" aria-label="問 AI">
      <div className="ah-card-head" style={{ padding: 0 }}>
        <h3><Sparkles size={18} aria-hidden /> {title}</h3>
        <span className="rc-by">{hint}</span>
      </div>
      <form
        className="rc-ask"
        onSubmit={(e) => {
          e.preventDefault()
          void ask(question)
        }}
      >
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder={placeholder}
          aria-label="向 AI 提問"
        />
        <button type="submit" className="admin-pill-btn primary" disabled={busy || question.trim().length < 2}>
          {busy ? '調查中…（可能需時約半分鐘）' : '詢問'}
        </button>
      </form>
      <div className="rc-presets">
        {examples.map((ex) => (
          <button key={ex} type="button" className="admin-pill-btn sm" disabled={busy} onClick={() => { setQuestion(ex); void ask(ex) }}>
            {ex}
          </button>
        ))}
      </div>
      {error ? <p className="bug-error" role="alert">{error}</p> : null}

      {out ? (
        <div className="rc-answer">
          {out.answer ? <div className="rc-summary"><AiText text={out.answer} resolveMember={resolveMember} onOpenMember={onOpenMember} /></div> : <p className="bug-error">{out.error ?? 'AI 沒有給出結論'}</p>}
          {out.auditError ? <p className="bug-error">審計記錄未能寫入：{out.auditError}</p> : null}
          <p className="rc-hint">
            {out.model ? `模型：${out.model} · ` : ''}共查了 {out.steps.length} 項資料。AI 的結論僅供參考{scope === 'members' ? '。' : '，金額請以 KPay 後台為準。'}
          </p>
          {out.steps.length > 0 ? (
            <details className="rc-trace">
              <summary>AI 查了什麼（{out.steps.length}）</summary>
              <ol className="rc-steps">
                {out.steps.map((s, i) => (
                  <li key={`${s.tool}-${i}`} className={s.ok ? 'ok' : 'fail'}>
                    <span className="rc-step-ic">{s.ok ? <CheckCircle2 size={16} aria-label="成功" /> : <XCircle size={16} aria-label="失敗" />}</span>
                    <div>
                      <b>{TOOL_LABEL[s.tool] ?? s.tool}</b>
                      <small>{s.args}</small>
                    </div>
                    <time className="admin-num">{s.ms} ms</time>
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
