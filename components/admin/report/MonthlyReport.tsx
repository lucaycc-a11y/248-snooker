'use client'

/**
 * MonthlyReport — 月報. Dashboard-style, A4-printable. Spark's suggestions come first because they
 * are the part the owner acts on; the numbers underneath are the evidence.
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Download, Loader2, RefreshCw, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import type { MonthlyReportData } from '@/lib/data/getAdminMonthlyReport'
import { ruleSuggestions, type MonthlySuggestion } from '@/lib/admin/monthlySuggestions'
import { EFFORT_LABEL, rulePlan, type MonthlyAnalysis } from '@/lib/admin/monthlyAnalysis'
import { money } from '@/lib/admin/today'

type SparkState =
  | { status: 'loading' }
  | { status: 'ready'; analysis: MonthlyAnalysis }

const PRIO: Record<MonthlySuggestion['priority'], string> = { high: '優先', medium: '留意', low: '參考' }

function pct(now: number, before: number): number | null {
  return before > 0 ? Math.round(((now - before) / before) * 100) : null
}

function Delta({ now, before, label }: { now: number; before: number; label: string }) {
  const p = pct(now, before)
  if (p === null) return <span className="mr-delta">{before === 0 && now === 0 ? `與${label}相同` : `${label}沒有數據`}</span>
  const up = p >= 0
  return (
    <span className={`mr-delta ${up ? 'up' : 'down'}`}>
      {up ? <TrendingUp size={13} aria-hidden /> : <TrendingDown size={13} aria-hidden />}
      {up ? '+' : ''}{p}% 對比{label}
    </span>
  )
}

function Bars({ rows, total }: { rows: { label: string; value: number; sub: string }[]; total: number }) {
  if (rows.length === 0) return <p className="mr-none">沒有資料</p>
  return (
    <ul className="mr-hbars">
      {rows.map((r) => (
        <li key={r.label}>
          <span className="mr-hl">{r.label}</span>
          <span className="mr-ht"><i style={{ width: `${total > 0 ? Math.max(3, (r.value / total) * 100) : 0}%` }} /></span>
          <span className="mr-hv">{r.sub}</span>
        </li>
      ))}
    </ul>
  )
}

function Columns({ rows, unit, title }: { rows: { label: string; value: number }[]; unit: (n: number) => string; title: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  const w = 1000
  const h = 110
  const gap = 3
  const bw = Math.max(4, (w - gap * (rows.length - 1)) / Math.max(1, rows.length))
  return (
    <svg viewBox={`0 0 ${w} ${h + 22}`} className="mr-cols" role="img" aria-label={title}>
      {rows.map((r, i) => {
        const bh = r.value > 0 ? Math.max(3, (r.value / max) * h) : 2
        const x = i * (bw + gap)
        return (
          <g key={r.label}>
            <rect x={x} y={h - bh} width={bw} height={bh} rx={Math.min(4, bw / 2)} className={r.value > 0 ? 'on' : 'off'}>
              <title>{`${r.label}：${unit(r.value)}`}</title>
            </rect>
            {rows.length <= 16 || i % 5 === 0 ? <text x={x + bw / 2} y={h + 16} textAnchor="middle">{r.label}</text> : null}
          </g>
        )
      })}
    </svg>
  )
}

export default function MonthlyReport({ data, thisMonth }: { data: MonthlyReportData; thisMonth: string }) {
  const router = useRouter()
  const [spark, setSpark] = useState<SparkState>({ status: 'loading' })
  const t = data.totals
  const p = data.prevTotals

  const load = useCallback(async () => {
    setSpark({ status: 'loading' })
    try {
      const res = await fetch('/api/admin/report/monthly-spark', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month: data.month }) })
      const j: unknown = await res.json().catch(() => null)
      if (res.ok && typeof j === 'object' && j !== null && 'suggestions' in j) {
        setSpark({ status: 'ready', analysis: j as MonthlyAnalysis })
        return
      }
    } catch { /* fall through to local rules */ }
    const rules = ruleSuggestions(data)
    setSpark({ status: 'ready', analysis: { source: 'rules', summary: '', focus: rules[0]?.title ?? '', suggestions: rules, plan: rulePlan(data, rules), note: '暫時未能連接 Spark，已改用規則分析' } })
  }, [data])
  useEffect(() => { void load() }, [load])

  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfErr, setPdfErr] = useState<string | null>(null)
  async function downloadPdf() {
    if (spark.status !== 'ready') return
    setPdfBusy(true); setPdfErr(null)
    try {
      const res = await fetch('/api/admin/report/monthly-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month: data.month, analysis: spark.analysis }) })
      if (!res.ok) throw new Error('failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = `Space8-monthly-report-${data.month}.pdf`
      document.body.appendChild(link); link.click(); link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch { setPdfErr('PDF 產生失敗，請再試') } finally { setPdfBusy(false) }
  }

  const [mailBusy, setMailBusy] = useState(false)
  const [mailMsg, setMailMsg] = useState<string | null>(null)
  async function mailToMe() {
    if (spark.status !== 'ready') return
    setMailBusy(true); setMailMsg(null)
    try {
      const res = await fetch('/api/admin/report/monthly-send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month: data.month, analysis: spark.analysis }) })
      const j: unknown = await res.json().catch(() => null)
      const err = typeof j === 'object' && j !== null && 'error' in j ? String((j as { error: unknown }).error) : null
      setMailMsg(res.ok ? '已電郵俾你（含 PDF）' : err ?? '電郵發送失敗，請再試')
    } catch { setMailMsg('電郵發送失敗，請再試') } finally { setMailBusy(false) }
  }

  const a = data.attempts
  const b = data.bookings
  const periodTotal = data.byPeriod.reduce((s, x) => s + x.revenue, 0)

  return (
    <div className="mr">
      <div className="mr-controls ar-noprint">
        <input type="month" value={data.month} max={thisMonth} onChange={(e) => e.target.value && router.push(`/admin/report/monthly?month=${e.target.value}`)} aria-label="選擇月份" className="ar-date" />
        {pdfErr ? <span className="em-err" role="alert">{pdfErr}</span> : null}
        {mailMsg ? <span role="status">{mailMsg}</span> : null}
        <button type="button" className="admin-pill-btn" onClick={() => void mailToMe()} disabled={spark.status === 'loading' || mailBusy}>
          {mailBusy ? <Loader2 size={18} className="sp-spin" aria-hidden /> : <Download size={18} aria-hidden />} 電郵俾我
        </button>
        <button type="button" className="admin-pill-btn" onClick={() => void downloadPdf()} disabled={spark.status === 'loading' || pdfBusy}>
          {pdfBusy ? <Loader2 size={18} className="sp-spin" aria-hidden /> : <Download size={18} aria-hidden />} 下載 PDF
        </button>
      </div>
      {data.error ? <div className="admin-card ah-alert bad" role="alert">部分資料載入失敗：{data.error}</div> : null}

      <header className="mr-cover admin-card">
        <div>
          <span className="mr-brand">SPACE8</span>
          <h2>{data.label} 營運月報</h2>
          <p>{data.from} 至 {data.to}{data.partial ? `（本月未完，對比${data.prevLabel}同日數）` : ''} · 不包括測試預約及隱藏帳戶</p>
        </div>
        <span className="mr-gen">製作日期 {new Date().toLocaleDateString('zh-HK')}</span>
      </header>

      <section className="mr-kpis" aria-label="重點數字">
        <div className="admin-card mr-kpi hero"><span>收入</span><b>{money(t.revenue)}</b><Delta now={t.revenue} before={p.revenue} label={data.prevLabel} /></div>
        <div className="admin-card mr-kpi"><span>已確認預約</span><b>{t.bookingCount}</b><Delta now={t.bookingCount} before={p.bookingCount} label={data.prevLabel} /></div>
        <div className="admin-card mr-kpi"><span>新會員</span><b>{data.members.newCount}</b><Delta now={data.members.newCount} before={data.members.prevCount} label={data.prevLabel} /></div>
        <div className="admin-card mr-kpi"><span>付款成功率</span><b>{a.successRate === null ? '—' : `${a.successRate}%`}</b><span className="mr-delta">失敗 {a.failed} · 逾時 {a.expired}</span></div>
      </section>

      <section className="admin-card mr-spark" aria-label="Spark 建議" aria-busy={spark.status === 'loading'}>
        <div className="mr-sec-head">
          <h3><Sparkles size={18} aria-hidden /> Spark 建議</h3>
          <button type="button" className="admin-pill-btn ar-noprint" onClick={() => void load()} disabled={spark.status === 'loading'}>
            {spark.status === 'loading' ? <Loader2 size={16} className="sp-spin" aria-hidden /> : <RefreshCw size={16} aria-hidden />} 重新分析
          </button>
        </div>
        {spark.status === 'loading' ? <p className="mr-none"><Loader2 size={14} className="sp-spin" aria-hidden /> Spark 分析 {data.label} 數據中…</p> : (<>
          {spark.analysis.summary ? <p className="mr-summary">{spark.analysis.summary}</p> : null}
          <ol className="mr-sug">
            {spark.analysis.suggestions.map((s, i) => (
              <li key={i} className={s.priority}>
                <span className="mr-badge">{PRIO[s.priority]}</span>
                <div>
                  <b>{s.title}<small>{s.category}</small></b>
                  <p className="why">{s.why}</p>
                  <p className="act"><i>建議</i>{s.action}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mr-note">{spark.analysis.source === 'spark' ? '由 Spark 根據本月數據產生，行動前請自行核對。' : '規則分析（非 AI）。'}{spark.analysis.note ? ` ${spark.analysis.note}` : ''}</p>
        </>)}
      </section>

      <section className="admin-card mr-sec" aria-label="收入">
        <div className="mr-sec-head"><h3>收入</h3><span className="mr-pill">淨收入 {money(t.net)}</span></div>
        <Columns title="每日收入" rows={data.daily.map((d) => ({ label: String(Number(d.date.slice(8))), value: d.revenue }))} unit={money} />
        <div className="mr-two">
          <div><h4>各時段</h4><Bars total={periodTotal} rows={data.byPeriod.map((x) => ({ label: x.label, value: x.revenue, sub: `${money(x.revenue)} · ${x.count}` }))} /></div>
          <div><h4>各房間</h4><Bars total={t.revenue} rows={data.byTable.map((x) => ({ label: x.label, value: x.revenue, sub: `${money(x.revenue)} · ${x.count}` }))} /></div>
          <div><h4>付款方式</h4><Bars total={t.revenue} rows={data.byMethod.map((x) => ({ label: x.label, value: x.revenue, sub: `${money(x.revenue)} · ${x.count}` }))} /></div>
          <div><h4>星期分佈</h4><Bars total={Math.max(1, ...data.weekday.map((x) => x.revenue))} rows={data.weekday.map((x) => ({ label: `星期${x.label}`, value: x.revenue, sub: `${money(x.revenue)} · ${x.count}` }))} /></div>
        </div>
      </section>

      <div className="mr-two-col">
        <section className="admin-card mr-sec" aria-label="失敗與風險">
          <div className="mr-sec-head"><h3><AlertTriangle size={16} aria-hidden /> 失敗與風險</h3></div>
          <ul className="mr-facts">
            <li><span>付款成功</span><b>{a.succeeded}</b></li>
            <li><span>付款失敗</span><b className={a.failed > 0 ? 'bad' : ''}>{a.failed}</b></li>
            <li><span>付款逾時／取消</span><b>{a.expired}</b></li>
            <li><span>預約取消</span><b>{b.cancelled}</b></li>
            <li><span>預約逾時失效</span><b>{b.expired}</b></li>
            <li><span>已退款預約</span><b>{b.refunded}</b></li>
            <li><span>仍待付款</span><b className={b.pending > 0 ? 'bad' : ''}>{b.pending}</b></li>
            <li><span>系統錯誤（未處理）</span><b className={data.errors.unresolved > 0 ? 'bad' : ''}>{data.errors.total}（{data.errors.unresolved}）</b></li>
          </ul>
          {data.errors.bySource.length > 0 ? (
            <><h4>錯誤來源</h4><Bars total={data.errors.bySource[0].count} rows={data.errors.bySource.map((x) => ({ label: x.source, value: x.count, sub: `${x.count} 次` }))} /></>
          ) : <p className="mr-none">本期沒有系統錯誤</p>}
        </section>

        <section className="admin-card mr-sec" aria-label="新會員">
          <div className="mr-sec-head"><h3>新會員</h3><span className="mr-pill">{data.members.newCount} 人</span></div>
          <Columns title="每日新會員" rows={data.members.daily.map((d) => ({ label: String(Number(d.date.slice(8))), value: d.count }))} unit={(n) => `${n} 人`} />
          <p className="mr-note">{data.prevLabel}同期：{data.members.prevCount} 人</p>
        </section>
      </div>

      <section className="admin-card mr-sec" aria-label="其他">
        <div className="mr-sec-head"><h3>其他</h3></div>
        <div className="mr-two">
          <ul className="mr-facts">
            <li><span>平均每張預約</span><b>{money(t.averagePerBooking)}</b></li>
            <li><span>退款總額</span><b>{money(t.refund)}</b></li>
            <li><span>優惠碼折扣</span><b>{money(t.promoDiscount)}</b></li>
            <li><span>積分／錢包抵扣</span><b>{money(t.pointsDiscount + t.creditDiscount)}</b></li>
            <li><span>預約總數（含失效）</span><b>{b.total}</b></li>
          </ul>
          <div>
            <h4>優惠碼使用</h4>
            {data.promos.length === 0 ? <p className="mr-none">本期沒有使用優惠碼</p> : (
              <ul className="mr-facts">{data.promos.slice(0, 6).map((x) => <li key={x.code}><span className="admin-mono">{x.code}</span><b>{x.uses} 次 · −{money(x.totalDiscount)}</b></li>)}</ul>
            )}
          </div>
        </div>
      </section>

      <section className="admin-card mr-plan" aria-label="下月改善行動計劃">
        <div className="mr-sec-head"><h3><Sparkles size={18} aria-hidden /> 下月改善行動計劃</h3></div>
        {spark.status === 'loading' ? <p className="mr-none">等待 Spark…</p> : (<>
          {spark.analysis.focus ? <p className="mr-focus"><i>重點</i>{spark.analysis.focus}</p> : null}
          <ol className="mr-plan-list">
            {spark.analysis.plan.map((it, i) => (
              <li key={i}>
                <div className="mr-plan-head"><span className="mr-pill">{it.area}</span><b>{i + 1}. {it.goal}</b><small>投入：{EFFORT_LABEL[it.effort]}</small></div>
                <ul>{it.steps.map((x, j) => <li key={j}>{x}</li>)}</ul>
                <p className="mr-note">衡量：{it.metric}</p>
              </li>
            ))}
          </ol>
        </>)}
      </section>

      <footer className="mr-foot">Space8 營運月報 · {data.label} · 由 Spark（FORM）準備；數字來自後台收入、付款、會員同錯誤記錄，建議只供參考。</footer>
    </div>
  )
}
