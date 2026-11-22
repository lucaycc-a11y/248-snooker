import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { ensureFonts } from '@/lib/admin/monthlyPdf'
import { hkd, summarise, type Space8Data } from '@/lib/admin/space8Ledger'

// 費用帳 PDF: summary page first (what was spent, what is claimed, what is still owed), then the ledgers.

const C = { green: '#134a2e', accent: '#2f9a60', text: '#1b1b1b', muted: '#6b7280', line: '#e1e1da', soft: '#f4f6f3', red: '#c0392b', amber: '#b9770e', amberBg: '#fdf3e0' }
const st = StyleSheet.create({
  page: { fontFamily: 'NotoTC', fontSize: 9, color: C.text, padding: 28, paddingBottom: 44 },
  cover: { backgroundColor: C.green, borderRadius: 12, padding: 16, marginBottom: 10 },
  brand: { fontSize: 8, letterSpacing: 3, color: '#cfe8d8', fontWeight: 700 },
  title: { fontSize: 20, fontWeight: 700, color: '#fff', marginTop: 4 },
  coverSub: { fontSize: 8.5, color: '#cfe8d8', marginTop: 4 },
  row: { flexDirection: 'row', gap: 8 },
  kpi: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 9 },
  kpiHot: { flex: 1, borderWidth: 1.5, borderColor: C.accent, backgroundColor: '#f3faf6', borderRadius: 10, padding: 9 },
  kpiL: { fontSize: 8, color: C.muted },
  kpiV: { fontSize: 16, fontWeight: 700, marginTop: 2 },
  kpiD: { fontSize: 7.5, marginTop: 2, color: C.muted },
  card: { borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 11, marginTop: 8 },
  h3: { fontSize: 12, fontWeight: 700, marginBottom: 6 },
  track: { height: 7, borderRadius: 4, backgroundColor: '#e9ece7' },
  fill: { height: 7, borderRadius: 4, backgroundColor: C.accent },
  th: { flexDirection: 'row', backgroundColor: C.soft, paddingVertical: 4, paddingHorizontal: 4, borderRadius: 4 },
  thT: { fontSize: 8, fontWeight: 700, color: C.muted },
  tr: { flexDirection: 'row', paddingVertical: 3.5, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: C.line },
  trTotal: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 4, backgroundColor: C.soft, marginTop: 2, borderRadius: 4 },
  bold: { fontWeight: 700 },
  right: { textAlign: 'right' },
  footer: { position: 'absolute', left: 28, right: 28, bottom: 16, fontSize: 7.5, color: C.muted, flexDirection: 'row', justifyContent: 'space-between' },
  hint: { fontSize: 8, color: C.muted, marginTop: 6, lineHeight: 1.4 },
})

type Col = { w: number; align?: 'right' }
function Table({ head, cols, rows, total }: { head: string[]; cols: Col[]; rows: string[][]; total?: string[] }) {
  const cell = (c: Col, _i: number) => [{ width: `${c.w}%` }, c.align === 'right' ? st.right : {}]
  return (
    <View>
      <View style={st.th} fixed>
        {head.map((h, i) => <Text key={i} style={[st.thT, ...cell(cols[i], i)]}>{h}</Text>)}
      </View>
      {rows.map((r, ri) => (
        <View key={ri} style={st.tr} wrap={false}>
          {r.map((v, i) => <Text key={i} style={cell(cols[i], i)}>{v}</Text>)}
        </View>
      ))}
      {total ? (
        <View style={st.trTotal} wrap={false}>
          {total.map((v, i) => <Text key={i} style={[st.bold, ...cell(cols[i], i)]}>{v}</Text>)}
        </View>
      ) : null}
    </View>
  )
}

const mLabel = (m: string) => `${m.slice(0, 4)} 年 ${Number(m.slice(5))} 月`
const pctStr = (n: number) => `${Math.round(n * 100)}%`

function Footer({ today }: { today: string }) {
  return (
    <View style={st.footer} fixed>
      <Text>SPACE8 費用帳 · {today}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )
}

export async function renderSpace8Pdf(data: Space8Data, today: string): Promise<Buffer> {
  ensureFonts()
  const s = summarise(data)
  const ai = data.expenses.filter((e) => e.kind === 'ai')
  const other = data.expenses.filter((e) => e.kind === 'other')

  const doc: ReactElement = (
    <Document title={`SPACE8 費用帳 ${today}`} author="SPACE8">
      <Page size="A4" style={st.page}>
        <View style={st.cover}>
          <Text style={st.brand}>SPACE8</Text>
          <Text style={st.title}>費用及 Claim 總覽</Text>
          <Text style={st.coverSub}>截至 {today} · 幣種 HKD · 先由各人墊付，再向公司分次 Claim</Text>
        </View>

        <View style={st.row}>
          <View style={st.kpi}>
            <Text style={st.kpiL}>總開支（已墊付）</Text>
            <Text style={st.kpiV}>{hkd(s.expenseTotal)}</Text>
            <Text style={st.kpiD}>AI {hkd(s.aiTotal)} · 其他 {hkd(s.otherTotal)}</Text>
          </View>
          <View style={st.kpi}>
            <Text style={st.kpiL}>已 Claim</Text>
            <Text style={st.kpiV}>{hkd(s.claimedTotal)}</Text>
            <Text style={st.kpiD}>佔開支 {pctStr(s.claimPct)} · {data.claims.length} 次</Text>
          </View>
          <View style={st.kpiHot}>
            <Text style={st.kpiL}>未 Claim</Text>
            <Text style={[st.kpiV, { color: s.outstandingTotal < 0 ? C.red : C.green }]}>{hkd(s.outstandingTotal)}</Text>
            <Text style={st.kpiD}>開支 − 已 Claim</Text>
          </View>
        </View>
        <View style={[st.row, { marginTop: 8 }]}>
          <View style={st.kpi}>
            <Text style={st.kpiL}>資本</Text>
            <Text style={st.kpiV}>{hkd(s.capital)}</Text>
          </View>
          <View style={st.kpi}>
            <Text style={st.kpiL}>資本餘額</Text>
            <Text style={st.kpiV}>{hkd(s.balance)}</Text>
            <Text style={st.kpiD}>已用資本 {pctStr(s.capitalSpentPct)}</Text>
          </View>
        </View>

        <View style={st.card}>
          <Text style={st.h3}>Claim 進度</Text>
          <View style={st.track}><View style={[st.fill, { width: `${Math.min(100, Math.round(s.claimPct * 100))}%` }]} /></View>
          <Text style={st.hint}>Claim 只用來扣減「未 Claim」，不計入開支。</Text>
        </View>

        <View style={st.card}>
          <Text style={st.h3}>各人墊付及 Claim</Text>
          <Table
            head={['姓名', '已墊付', '已 Claim', '未 Claim', 'Claim 進度']}
            cols={[{ w: 28 }, { w: 18, align: 'right' }, { w: 18, align: 'right' }, { w: 18, align: 'right' }, { w: 18, align: 'right' }]}
            rows={s.payers.map((p) => [p.name, hkd(p.paid), hkd(p.claimed), hkd(p.outstanding), p.paid > 0 ? pctStr(p.claimPct) : '—'])}
            total={['合計', hkd(s.expenseTotal), hkd(s.claimedTotal), hkd(s.outstandingTotal), pctStr(s.claimPct)]}
          />
        </View>

        <View style={st.card}>
          <Text style={st.h3}>每月開支</Text>
          <Table
            head={['月份', 'AI Usage', '其他開支', '合計', '累計']}
            cols={[{ w: 28 }, { w: 18, align: 'right' }, { w: 18, align: 'right' }, { w: 18, align: 'right' }, { w: 18, align: 'right' }]}
            rows={s.months.map((m) => [mLabel(m.month), hkd(m.ai), hkd(m.other), hkd(m.total), hkd(m.cumulative)])}
            total={['合計', hkd(s.aiTotal), hkd(s.otherTotal), hkd(s.expenseTotal), '']}
          />
        </View>
        <Footer today={today} />
      </Page>

      <Page size="A4" style={st.page}>
        <View style={st.card}>
          <Text style={st.h3}>其他開支（按項目）</Text>
          <Table
            head={['項目', '次數', '金額', '佔比', '平均']}
            cols={[{ w: 40 }, { w: 12, align: 'right' }, { w: 18, align: 'right' }, { w: 12, align: 'right' }, { w: 18, align: 'right' }]}
            rows={s.items.map((i) => [i.item, String(i.entries), hkd(i.amount), pctStr(i.pct), hkd(i.avg)])}
            total={['合計', String(other.length), hkd(s.otherTotal), '', '']}
          />
        </View>

        <View style={st.card}>
          <Text style={st.h3}>Claim 記錄</Text>
          {data.claims.length === 0 ? (
            <Text style={st.hint}>未有 Claim 記錄。</Text>
          ) : (
            <Table
              head={['日期', '付予', '金額', '備註']}
              cols={[{ w: 20 }, { w: 22 }, { w: 18, align: 'right' }, { w: 40 }]}
              rows={data.claims.map((c) => [c.claimedOn, c.paidTo, hkd(c.amount), c.note ?? ''])}
              total={['合計', '', hkd(s.claimedTotal), '']}
            />
          )}
        </View>
        <Footer today={today} />
      </Page>

      <Page size="A4" style={st.page}>
        <View style={st.card}>
          <Text style={st.h3}>其他開支明細（{other.length}）</Text>
          <Table
            head={['日期', '項目', '金額', '墊付人']}
            cols={[{ w: 20 }, { w: 42 }, { w: 16, align: 'right' }, { w: 22 }]}
            rows={other.map((e) => [e.spentOn, e.note ? `${e.item}（${e.note}）` : e.item, hkd(e.amount), e.paidBy])}
            total={['合計', '', hkd(s.otherTotal), '']}
          />
        </View>
        <View style={st.card}>
          <Text style={st.h3}>AI Usage 明細（{ai.length}）</Text>
          <Table
            head={['日期', '金額', '墊付人']}
            cols={[{ w: 34 }, { w: 30, align: 'right' }, { w: 36 }]}
            rows={ai.map((e) => [e.spentOn, hkd(e.amount), e.paidBy])}
            total={['合計', hkd(s.aiTotal), '']}
          />
        </View>
        <Footer today={today} />
      </Page>
    </Document>
  )
  return renderToBuffer(doc)
}
