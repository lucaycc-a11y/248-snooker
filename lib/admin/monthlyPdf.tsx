import path from 'node:path'
import { Document, Font, Page, Rect, StyleSheet, Svg, Text, View, renderToBuffer } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import type { MonthlyReportData } from '@/lib/data/getAdminMonthlyReport'
import { EFFORT_LABEL, type MonthlyAnalysis } from '@/lib/admin/monthlyAnalysis'
import type { MonthlySuggestion } from '@/lib/admin/monthlySuggestions'
import { money } from '@/lib/admin/today'

// Server-side PDF of 月報, used by the admin download button and the end-of-month email. The layout
// mirrors the on-screen report: Spark's suggestions first, numbers as evidence, the improvement plan last.

const FONT_DIR = path.join(process.cwd(), 'assets', 'fonts')
let fontsReady = false
function ensureFonts() {
  if (fontsReady) return
  Font.register({
    family: 'NotoTC',
    fonts: [
      { src: path.join(FONT_DIR, 'NotoSansTC_400Regular.ttf'), fontWeight: 400 },
      { src: path.join(FONT_DIR, 'NotoSansTC_700Bold.ttf'), fontWeight: 700 },
    ],
  })
  Font.registerHyphenationCallback((w) => [w]) // never hyphenate; CJK wraps per character
  fontsReady = true
}

const C = { green: '#134a2e', accent: '#2f9a60', text: '#1b1b1b', muted: '#6b7280', line: '#e1e1da', soft: '#f4f6f3', red: '#c0392b', amber: '#b9770e' }
const st = StyleSheet.create({
  page: { fontFamily: 'NotoTC', fontSize: 9, color: C.text, padding: 28, paddingBottom: 40 },
  cover: { backgroundColor: C.green, color: '#fff', borderRadius: 12, padding: 16, marginBottom: 10 },
  brand: { fontSize: 8, letterSpacing: 3, color: '#cfe8d8', fontWeight: 700 },
  title: { fontSize: 20, fontWeight: 700, color: '#fff', marginTop: 4 },
  coverSub: { fontSize: 8.5, color: '#cfe8d8', marginTop: 4 },
  row: { flexDirection: 'row', gap: 8 },
  kpi: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 9 },
  kpiL: { fontSize: 8, color: C.muted },
  kpiV: { fontSize: 17, fontWeight: 700, marginTop: 2 },
  kpiD: { fontSize: 7.5, marginTop: 2, color: C.muted },
  card: { borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 11, marginTop: 8 },
  spark: { borderWidth: 1.5, borderColor: C.accent, backgroundColor: '#f3faf6' },
  h3: { fontSize: 12, fontWeight: 700, marginBottom: 6 },
  h4: { fontSize: 8.5, fontWeight: 700, color: C.muted, marginTop: 6, marginBottom: 4 },
  summary: { fontSize: 10.5, fontWeight: 700, lineHeight: 1.5, marginBottom: 6 },
  sug: { flexDirection: 'row', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 8, marginTop: 5 },
  badge: { fontSize: 7.5, fontWeight: 700, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 8, alignSelf: 'flex-start' },
  sugT: { fontSize: 10, fontWeight: 700 },
  small: { fontSize: 8.5, color: C.muted, lineHeight: 1.3, marginTop: 2 },
  act: { fontSize: 8.5, lineHeight: 1.3, marginTop: 2 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  barLabel: { width: 52, fontSize: 8 },
  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#e9ece7' },
  barVal: { fontSize: 8, color: C.muted, minWidth: 70, textAlign: 'right' },
  fact: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3.5, borderBottomWidth: 0.5, borderBottomColor: C.line },
  footer: { position: 'absolute', left: 28, right: 28, bottom: 16, fontSize: 7.5, color: C.muted, flexDirection: 'row', justifyContent: 'space-between' },
  focus: { backgroundColor: C.green, borderRadius: 10, padding: 12, marginBottom: 4 },
  planHead: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 4 },
  step: { flexDirection: 'row', gap: 5, marginTop: 2 },
})

const PRIO: Record<MonthlySuggestion['priority'], { label: string; bg: string; fg: string }> = {
  high: { label: '優先', bg: '#fbe4e1', fg: '#a5281b' }, medium: { label: '留意', bg: '#fbf0d6', fg: '#8a5d0a' }, low: { label: '參考', bg: '#def3e6', fg: '#1b6a42' },
}

function pct(now: number, before: number): string {
  if (before <= 0) return before === 0 && now === 0 ? '與上期相同' : '上期沒有數據'
  const p = Math.round(((now - before) / before) * 100)
  return `${p >= 0 ? '+' : ''}${p}%`
}

function Bars({ rows, total }: { rows: { label: string; value: number; sub: string }[]; total: number }) {
  if (rows.length === 0) return <Text style={st.small}>沒有資料</Text>
  return (
    <View>
      {rows.map((r) => (
        <View key={r.label} style={st.barRow} wrap={false}>
          <Text style={st.barLabel}>{r.label}</Text>
          <View style={st.barTrack}><View style={{ width: `${total > 0 ? Math.max(3, (r.value / total) * 100) : 0}%`, height: 6, borderRadius: 3, backgroundColor: C.accent }} /></View>
          <Text style={st.barVal}>{r.sub}</Text>
        </View>
      ))}
    </View>
  )
}

function Columns({ rows, width, height = 56 }: { rows: { label: string; value: number }[]; width: number; height?: number }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  const gap = 2
  const bw = Math.max(3, (width - gap * (rows.length - 1)) / Math.max(1, rows.length))
  return (
    <View>
      <Svg width={width} height={height}>
        {rows.map((r, i) => {
          const h = r.value > 0 ? Math.max(2, (r.value / max) * (height - 2)) : 1.5
          return <Rect key={r.label + i} x={i * (bw + gap)} y={height - h} width={bw} height={h} rx={1.5} fill={r.value > 0 ? C.accent : '#dfe3dc'} />
        })}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
        <Text style={{ fontSize: 6.5, color: C.muted }}>{rows[0]?.label}</Text>
        <Text style={{ fontSize: 6.5, color: C.muted }}>{rows[rows.length - 1]?.label}</Text>
      </View>
    </View>
  )
}

function Fact({ l, v, bad }: { l: string; v: string; bad?: boolean }) {
  return <View style={st.fact} wrap={false}><Text>{l}</Text><Text style={{ fontWeight: 700, color: bad ? C.red : C.text }}>{v}</Text></View>
}

function Footer({ label }: { label: string }) {
  return (
    <View style={st.footer} fixed>
      <Text>Space8 營運月報 · {label} · 由 Spark（FORM）準備，建議只供參考</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )
}

export function MonthlyPdfDocument({ data, analysis }: { data: MonthlyReportData; analysis: MonthlyAnalysis }): ReactElement {
  const t = data.totals
  const p = data.prevTotals
  const a = data.attempts
  const b = data.bookings
  const periodTotal = data.byPeriod.reduce((x, y) => x + y.revenue, 0)
  const wdMax = Math.max(1, ...data.weekday.map((x) => x.revenue))
  const half = (595 - 56 - 8) / 2 - 22
  const made = new Date().toLocaleDateString('zh-HK', { timeZone: 'Asia/Hong_Kong' })

  return (
    <Document title={`Space8 營運月報 ${data.label}`} author="Spark（FORM）" subject="Space8 monthly report">
      <Page size="A4" style={st.page}>
        <View style={st.cover}>
          <Text style={st.brand}>SPACE8</Text>
          <Text style={st.title}>{data.label} 營運月報</Text>
          <Text style={st.coverSub}>{data.from} 至 {data.to}{data.partial ? `（本月未完，對比${data.prevLabel}同日數）` : ''} · 不包括測試預約及隱藏帳戶 · 製作日期 {made}</Text>
        </View>

        <View style={st.row}>
          <View style={st.kpi}><Text style={st.kpiL}>收入</Text><Text style={[st.kpiV, { color: C.accent }]}>{money(t.revenue)}</Text><Text style={st.kpiD}>{pct(t.revenue, p.revenue)} 對比{data.prevLabel}</Text></View>
          <View style={st.kpi}><Text style={st.kpiL}>已確認預約</Text><Text style={st.kpiV}>{t.bookingCount}</Text><Text style={st.kpiD}>{pct(t.bookingCount, p.bookingCount)} 對比{data.prevLabel}</Text></View>
          <View style={st.kpi}><Text style={st.kpiL}>新會員</Text><Text style={st.kpiV}>{data.members.newCount}</Text><Text style={st.kpiD}>{pct(data.members.newCount, data.members.prevCount)} 對比{data.prevLabel}</Text></View>
          <View style={st.kpi}><Text style={st.kpiL}>付款成功率</Text><Text style={st.kpiV}>{a.successRate === null ? '—' : `${a.successRate}%`}</Text><Text style={st.kpiD}>失敗 {a.failed} · 逾時 {a.expired}</Text></View>
        </View>

        <View style={[st.card, st.spark]}>
          <Text style={st.h3}>Spark 建議</Text>
          {analysis.summary ? <Text style={st.summary}>{analysis.summary}</Text> : null}
          {analysis.suggestions.map((s, i) => (
            <View key={i} style={st.sug} wrap={false}>
              <Text style={[st.badge, { backgroundColor: PRIO[s.priority].bg, color: PRIO[s.priority].fg }]}>{PRIO[s.priority].label}</Text>
              <View style={{ flex: 1 }}>
                <Text style={st.sugT}>{s.title}  <Text style={{ fontSize: 7.5, color: C.muted, fontWeight: 400 }}>{s.category}</Text></Text>
                <Text style={st.small}>{s.why}</Text>
                <Text style={st.act}><Text style={{ fontWeight: 700, color: C.accent }}>建議　</Text>{s.action}</Text>
              </View>
            </View>
          ))}
          <Text style={[st.small, { marginTop: 6 }]}>{analysis.source === 'spark' ? '由 Spark 根據本月數據產生，行動前請自行核對。' : '規則分析（非 AI）。'}</Text>
        </View>
        <Footer label={data.label} />
      </Page>

      <Page size="A4" style={st.page}>
        <View style={[st.card, { marginTop: 0 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={st.h3}>收入</Text><Text style={{ fontSize: 8.5, color: C.accent, fontWeight: 700 }}>淨收入 {money(t.net)}</Text></View>
          <Columns rows={data.daily.map((d) => ({ label: d.date.slice(5), value: d.revenue }))} width={595 - 56 - 22} height={62} />
          <View style={[st.row, { marginTop: 4 }]}>
            <View style={{ flex: 1 }}>
              <Text style={st.h4}>各時段</Text>
              <Bars total={periodTotal} rows={data.byPeriod.map((x) => ({ label: x.label, value: x.revenue, sub: `${money(x.revenue)} · ${x.count}` }))} />
              <Text style={st.h4}>付款方式</Text>
              <Bars total={t.revenue} rows={data.byMethod.map((x) => ({ label: x.label, value: x.revenue, sub: `${money(x.revenue)} · ${x.count}` }))} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.h4}>各房間</Text>
              <Bars total={t.revenue} rows={data.byTable.map((x) => ({ label: x.label, value: x.revenue, sub: `${money(x.revenue)} · ${x.count}` }))} />
              <Text style={st.h4}>星期分佈</Text>
              <Bars total={wdMax} rows={data.weekday.map((x) => ({ label: `星期${x.label}`, value: x.revenue, sub: `${money(x.revenue)} · ${x.count}` }))} />
            </View>
          </View>
        </View>

        <View style={st.row}>
          <View style={[st.card, { flex: 1 }]}>
            <Text style={st.h3}>失敗與風險</Text>
            <Fact l="付款成功" v={String(a.succeeded)} />
            <Fact l="付款失敗" v={String(a.failed)} bad={a.failed > 0} />
            <Fact l="付款逾時／取消" v={String(a.expired)} />
            <Fact l="預約取消" v={String(b.cancelled)} />
            <Fact l="預約逾時失效" v={String(b.expired)} />
            <Fact l="已退款預約" v={String(b.refunded)} />
            <Fact l="仍待付款" v={String(b.pending)} bad={b.pending > 0} />
            <Fact l="系統錯誤（未處理）" v={`${data.errors.total}（${data.errors.unresolved}）`} bad={data.errors.unresolved > 0} />
            {data.errors.bySource.length > 0 ? (<><Text style={st.h4}>錯誤來源</Text><Bars total={data.errors.bySource[0].count} rows={data.errors.bySource.map((x) => ({ label: x.source.slice(0, 12), value: x.count, sub: `${x.count} 次` }))} /></>) : <Text style={st.small}>本期沒有系統錯誤</Text>}
          </View>
          <View style={[st.card, { flex: 1 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={st.h3}>新會員</Text><Text style={{ fontSize: 8.5, color: C.accent, fontWeight: 700 }}>{data.members.newCount} 人</Text></View>
            <Columns rows={data.members.daily.map((d) => ({ label: d.date.slice(5), value: d.count }))} width={half} height={50} />
            <Text style={st.small}>{data.prevLabel}同期：{data.members.prevCount} 人</Text>
            <Text style={st.h4}>其他</Text>
            <Fact l="平均每張預約" v={money(t.averagePerBooking)} />
            <Fact l="退款總額" v={money(t.refund)} />
            <Fact l="優惠碼折扣" v={money(t.promoDiscount)} />
            <Fact l="積分／錢包抵扣" v={money(t.pointsDiscount + t.creditDiscount)} />
            <Fact l="預約總數（含失效）" v={String(b.total)} />
            {data.promos.slice(0, 4).map((x) => <Fact key={x.code} l={`優惠碼 ${x.code}`} v={`${x.uses} 次 · −${money(x.totalDiscount)}`} />)}
          </View>
        </View>
        <Footer label={data.label} />
      </Page>

      <Page size="A4" style={st.page}>
        <View style={st.focus}>
          <Text style={{ fontSize: 8, letterSpacing: 2, color: '#cfe8d8', fontWeight: 700 }}>NEXT MONTH</Text>
          <Text style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginTop: 3 }}>下月改善行動計劃</Text>
          {analysis.focus ? <Text style={{ fontSize: 10, color: '#fff', marginTop: 5, lineHeight: 1.5 }}>重點：{analysis.focus}</Text> : null}
        </View>
        {analysis.plan.map((it, i) => (
          <View key={i} style={st.card} wrap={false}>
            <View style={st.planHead}>
              <Text style={[st.badge, { backgroundColor: '#def3e6', color: '#1b6a42' }]}>{it.area}</Text>
              <Text style={{ fontSize: 10.5, fontWeight: 700, flex: 1 }}>{i + 1}. {it.goal}</Text>
              <Text style={{ fontSize: 8, color: C.muted }}>投入：{EFFORT_LABEL[it.effort]}</Text>
            </View>
            {it.steps.map((x, j) => (<View key={j} style={st.step}><Text style={{ color: C.accent }}>•</Text><Text style={{ flex: 1, lineHeight: 1.2 }}>{x}</Text></View>))}
            <Text style={[st.small, { marginTop: 5 }]}>衡量：{it.metric}</Text>
          </View>
        ))}
        <View style={[st.card, { backgroundColor: C.soft }]}>
          <Text style={{ fontSize: 8.5, color: C.muted, lineHeight: 1.6 }}>
            此月報由 Spark（FORM 開發的 AI 助手）根據後台收入、付款、會員同錯誤記錄自動編製。建議只供參考，目標數字為推算建議；行動前請按實際情況核對。
          </Text>
        </View>
        <Footer label={data.label} />
      </Page>
    </Document>
  )
}

export async function renderMonthlyPdf(data: MonthlyReportData, analysis: MonthlyAnalysis): Promise<Buffer> {
  ensureFonts()
  return renderToBuffer(<MonthlyPdfDocument data={data} analysis={analysis} />)
}
