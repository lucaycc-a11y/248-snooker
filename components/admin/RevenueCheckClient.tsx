'use client'

/**
 * RevenueCheckClient — 收入核對. Read-only: the button runs a check that compares revenue,
 * bookings, payment attempts and KPay notifications, lists every step it took, and shows
 * anything unusual with the booking code to open in 客戶查詢. Below: what the automatic
 * patrol has found, and past runs.
 */

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, MailCheck, ShieldCheck, TriangleAlert, XCircle } from 'lucide-react'
import type { OpenAlert, PastRun } from '@/lib/data/getAdminChecks'
import type { CheckFinding, CheckStep, RevenueCheckResult } from '@/lib/admin/revenueCheck'
import AdminPageHead from './AdminPageHead'
import AiAssistantPanel from './AiAssistantPanel'
import { useAdminToast } from './ToastProvider'

type Props = { runs: PastRun[]; alerts: OpenAlert[]; loadError: string | null }

type RunResponse = {
  result: RevenueCheckResult
  summary: string
  model: string | null
  aiError: string | null
  saveError: string | null
  auditError: string | null
}

const SEV_LABEL = { high: '嚴重', medium: '留意', low: '輕微' } as const

function hkDate(offsetDays = 0): string {
  return new Date(Date.now() + 8 * 3600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10)
}

function monthStart(): string {
  return `${hkDate().slice(0, 8)}01`
}

function stamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

function isRunResponse(v: unknown): v is RunResponse {
  return typeof v === 'object' && v !== null && 'result' in v && 'summary' in v
}

function StepIcon({ status }: { status: CheckStep['status'] }) {
  if (status === 'ok') return <CheckCircle2 size={16} aria-label="正常" />
  if (status === 'warn') return <TriangleAlert size={16} aria-label="留意" />
  return <XCircle size={16} aria-label="失敗" />
}

function FindingRow({ f }: { f: CheckFinding }) {
  return (
    <li className={`rc-finding ${f.severity}`}>
      <span className={`rc-sev ${f.severity}`}>{SEV_LABEL[f.severity]}</span>
      <div>
        <b>{f.title}</b>
        <p>{f.detail}</p>
        {f.evidence.length > 0 ? (
          <ul className="rc-evidence">
            {f.evidence.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}
      </div>
      {f.code ? (
        <Link href={`/admin/lookup?q=${encodeURIComponent(f.code)}`} className="admin-pill-btn sm">客戶查詢</Link>
      ) : null}
    </li>
  )
}

export default function RevenueCheckClient({ runs, alerts, loadError }: Props) {
  const toast = useAdminToast()
  const [from, setFrom] = useState(hkDate(-6))
  const [to, setTo] = useState(hkDate())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [out, setOut] = useState<RunResponse | null>(null)
  const [mailBusy, setMailBusy] = useState(false)

  const preset = (a: string, b: string) => {
    setFrom(a)
    setTo(b)
  }

  const run = async () => {
    setBusy(true)
    setError(null)
    setOut(null)
    try {
      const res = await fetch('/api/admin/revenue-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to }),
      })
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        const msg = typeof body === 'object' && body !== null && 'error' in body ? String((body as { error: unknown }).error) : '核對失敗'
        setError(msg)
        return
      }
      if (isRunResponse(body)) setOut(body)
      else setError('回應格式不正確')
    } catch {
      setError('網絡錯誤，請稍後再試')
    } finally {
      setBusy(false)
    }
  }

  const sendTest = async () => {
    setMailBusy(true)
    try {
      const res = await fetch('/api/admin/test-email', { method: 'POST' })
      const body: unknown = await res.json().catch(() => null)
      const rec = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
      if (res.ok) toast.show({ message: '測試電郵已發送', detail: Array.isArray(rec.to) ? rec.to.join('、') : undefined, tone: 'success' })
      else toast.show({ message: typeof rec.error === 'string' ? rec.error : '發送失敗', tone: 'error' })
    } catch {
      toast.show({ message: '網絡錯誤', tone: 'error' })
    } finally {
      setMailBusy(false)
    }
  }

  const result = out?.result
  const t = result?.totals

  return (
    <>
      <AdminPageHead sub="核對收入、預約、付款記錄和 KPay 通知，找出異常。只讀取資料，不會修改任何東西" />

      {loadError ? <div className="admin-card ah-alert bad" role="alert">{loadError}</div> : null}

      <AiAssistantPanel />

      <section className="admin-card rc-run" aria-label="開始核對">
        <div className="rc-presets">
          <button type="button" className="admin-pill-btn sm" onClick={() => preset(hkDate(), hkDate())}>今日</button>
          <button type="button" className="admin-pill-btn sm" onClick={() => preset(hkDate(-1), hkDate(-1))}>昨日</button>
          <button type="button" className="admin-pill-btn sm" onClick={() => preset(hkDate(-6), hkDate())}>近 7 日</button>
          <button type="button" className="admin-pill-btn sm" onClick={() => preset(monthStart(), hkDate())}>本月</button>
        </div>
        <div className="rc-range">
          <label>
            由
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            至
            <input type="date" value={to} min={from} max={hkDate()} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button type="button" className="admin-pill-btn primary" onClick={run} disabled={busy || !from || !to}>
            <ShieldCheck size={18} aria-hidden />
            {busy ? '核對中…' : '開始核對'}
          </button>
        </div>
        <p className="rc-hint">日期按預約的遊玩日期計算，與收入頁相同；已排除測試預約及隱藏帳戶。每日最多核對 10 次。</p>
        {error ? <p className="bug-error" role="alert">{error}</p> : null}
      </section>

      {result ? (
        <div className="ah-grid">
          <section className="admin-card ah-card s4" aria-label="結論">
            <div className="ah-card-head">
              <h3>結論</h3>
              <span className="rc-by">{out?.model ? `由 AI（${out.model}）說明，數字由程式計算` : '程式摘要'}</span>
            </div>
            <p className="rc-summary">{out?.summary}</p>
            {out?.aiError ? <p className="rc-hint">AI 說明暫時不可用（{out.aiError}），以上為程式摘要。</p> : null}
            {out?.saveError ? <p className="bug-error">{out.saveError}</p> : null}
            {out?.auditError ? <p className="bug-error">審計記錄未能寫入：{out.auditError}</p> : null}
            {result.error ? <p className="bug-error">{result.error}</p> : null}
            {t ? (
              <ul className="rc-totals">
                <li><span>收入</span><b className="admin-num">HK${t.revenue}</b></li>
                <li><span>已確認預約</span><b className="admin-num">{t.bookingCount}</b></li>
                <li><span>退款</span><b className="admin-num">HK${t.refund}</b></li>
                <li><span>已核對預約</span><b className="admin-num">{t.checkedBookings}</b></li>
                <li><span>付款成功／失敗／逾時</span><b className="admin-num">{t.attempts.succeeded}／{t.attempts.failed}／{t.attempts.expired}</b></li>
              </ul>
            ) : null}
          </section>

          <section className="admin-card ah-card s4" aria-label="異常">
            <div className="ah-card-head"><h3>需要留意<span className="ah-count">{result.findings.length}</span></h3></div>
            {result.findings.length === 0 ? (
              <div className="ah-empty"><b>沒有發現異常</b><span>收入、預約和付款記錄互相吻合</span></div>
            ) : (
              <ul className="rc-findings">
                {result.findings.map((f) => (
                  <FindingRow key={f.id} f={f} />
                ))}
              </ul>
            )}
          </section>

          <section className="admin-card ah-card s4" aria-label="核對步驟">
            <div className="ah-card-head"><h3>核對步驟</h3></div>
            <ol className="rc-steps">
              {result.steps.map((s) => (
                <li key={s.key} className={s.status}>
                  <span className="rc-step-ic"><StepIcon status={s.status} /></span>
                  <div>
                    <b>{s.label}</b>
                    <small>{s.detail}</small>
                  </div>
                  <time className="admin-num">{s.ms} ms</time>
                </li>
              ))}
            </ol>
          </section>
        </div>
      ) : null}

      <div className="ah-grid">
        <section className="admin-card ah-card s2" aria-label="自動巡檢">
          <div className="ah-card-head">
            <h3>自動巡檢<span className="ah-count">{alerts.length}</span></h3>
            <button type="button" className="admin-pill-btn sm" onClick={sendTest} disabled={mailBusy}>
              <MailCheck size={16} aria-hidden />
              {mailBusy ? '發送中…' : '發送測試電郵'}
            </button>
          </div>
          <p className="rc-hint">系統每 10 分鐘自動檢查：客人付款失敗、網站錯誤增加、收入與付款不符。發現新問題時，AI 會先判斷值不值得調查（例如客人自己取消就不用），值得才用只讀工具查證並附上診斷。一般問題只電郵給店主；「KPay 已付款但預約未確認」及重複扣款會電郵給所有管理員。</p>
          {alerts.length === 0 ? (
            <div className="ah-empty"><b>目前沒有未處理的警報</b></div>
          ) : (
            <ul className="rc-findings">
              {alerts.map((a) => (
                <li key={a.key} className={`rc-finding ${a.critical ? 'high' : a.severity}`}>
                  <span className={`rc-sev ${a.critical ? 'high' : a.severity}`}>{a.critical ? '緊急' : SEV_LABEL[a.severity]}</span>
                  <div>
                    <b>{a.title}</b>
                    <p>{a.detail}</p>
                    {a.aiAnswer ? <p className="rc-ai"><b>AI 診斷</b>{a.aiModel ? `（${a.aiModel}）` : ''}{'\n'}{a.aiAnswer}</p> : a.aiReason ? <p className="rc-hint">AI 判斷無須調查：{a.aiReason}</p> : null}
                    <small className="rc-meta">首次發現 {stamp(a.firstSeenAt)} · {a.lastEmailedAt ? `已電郵 ${stamp(a.lastEmailedAt)}` : '未電郵'}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="admin-card ah-card s2" aria-label="過往核對">
          <div className="ah-card-head"><h3>過往核對</h3></div>
          {runs.length === 0 ? (
            <div className="ah-empty"><b>還沒有核對記錄</b></div>
          ) : (
            <ul className="rc-runs">
              {runs.map((r) => (
                <li key={r.id}>
                  <b>{r.from === r.to ? r.from : `${r.from} 至 ${r.to}`}</b>
                  <span className={`rc-count ${r.findingCount > 0 ? 'warn' : ''}`}>{r.findingCount > 0 ? `${r.findingCount} 項異常` : '無異常'}</span>
                  <small>{stamp(r.createdAt)} · {r.requestedBy ?? '系統'}</small>
                  {r.summary ? <p>{r.summary}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
