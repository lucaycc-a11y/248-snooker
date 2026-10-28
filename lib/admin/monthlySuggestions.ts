import type { MonthlyReportData } from '@/lib/data/getAdminMonthlyReport'

export type Priority = 'high' | 'medium' | 'low'
export type MonthlySuggestion = { priority: Priority; category: string; title: string; why: string; action: string }

const hk = (n: number) => `HK$${Math.round(n).toLocaleString('en-US')}`
const pct = (now: number, before: number): number | null => (before > 0 ? Math.round(((now - before) / before) * 100) : null)

/** Numbers-only digest handed to Spark; also what the rule-based fallback reads. */
export function compactStats(d: MonthlyReportData) {
  const t = d.totals
  const p = d.prevTotals
  return {
    期間: `${d.from} 至 ${d.to}${d.partial ? '（本月未完，對比上月同日數）' : ''}`,
    收入: { 本期: t.revenue, 上期: p.revenue, 變化百分比: pct(t.revenue, p.revenue), 淨收入: t.net, 退款: t.refund, 已確認預約: t.bookingCount, 上期預約: p.bookingCount, 平均每張: t.averagePerBooking, 優惠碼折扣: t.promoDiscount },
    預約狀態: d.bookings,
    付款嘗試: d.attempts,
    各時段收入: d.byPeriod.map((x) => ({ 時段: x.label, 收入: x.revenue, 張數: x.count })),
    各房收入: d.byTable.map((x) => ({ 房: x.label, 收入: x.revenue, 張數: x.count })),
    付款方式: d.byMethod.map((x) => ({ 方式: x.label, 收入: x.revenue, 張數: x.count })),
    星期分佈: d.weekday.map((x) => ({ 星期: x.label, 收入: x.revenue, 張數: x.count })),
    優惠碼: d.promos.slice(0, 5),
    新會員: { 本期: d.members.newCount, 上期同期: d.members.prevCount },
    系統錯誤: { 總數: d.errors.total, 未處理: d.errors.unresolved, 來源: d.errors.bySource },
  }
}

/** Deterministic suggestions — always available, and the fallback when Spark can't be reached. */
export function ruleSuggestions(d: MonthlyReportData): MonthlySuggestion[] {
  const out: MonthlySuggestion[] = []
  const t = d.totals
  const p = d.prevTotals
  const rev = pct(t.revenue, p.revenue)

  if (t.revenue === 0 && t.bookingCount === 0) {
    return [{ priority: 'medium', category: '收入', title: '本期沒有已確認收入', why: `${d.from} 至 ${d.to} 沒有已確認預約。`, action: '先確認資料範圍是否正確；如屬正常，可考慮推出優惠或電郵提醒會員。' }]
  }
  if (rev !== null && rev <= -10) out.push({ priority: 'high', category: '收入', title: `收入較${d.prevLabel}同期下跌 ${Math.abs(rev)}%`, why: `本期 ${hk(t.revenue)}，上期 ${hk(p.revenue)}。`, action: '查看「各時段」同「星期分佈」找出下跌位置，針對疲弱時段推優惠碼或電郵。' })
  else if (rev !== null && rev >= 10) out.push({ priority: 'low', category: '收入', title: `收入較${d.prevLabel}同期上升 ${rev}%`, why: `本期 ${hk(t.revenue)}，上期 ${hk(p.revenue)}。`, action: '回顧上月做過嘅推廣或新會員來源，延續有效做法。' })

  const a = d.attempts
  const failedShare = a.successRate === null ? 0 : 100 - a.successRate
  if (a.successRate !== null && failedShare >= 15) out.push({ priority: 'high', category: '付款', title: `付款成功率只有 ${a.successRate}%`, why: `成功 ${a.succeeded}、失敗 ${a.failed}、逾時／取消 ${a.expired}。`, action: '到「付款記錄」睇失敗原因；如集中喺某種付款方式，先檢查該渠道設定。' })
  if (d.bookings.pending > 0) out.push({ priority: 'medium', category: '付款', title: `仍有 ${d.bookings.pending} 張預約停留喺待付款`, why: '待付款預約會佔住時段。', action: '到「預約」篩選待付款，確認是否需要釋放時段或跟進客人。' })

  if (d.errors.unresolved >= 10) {
    const top = d.errors.bySource[0]
    out.push({ priority: 'high', category: '系統', title: `${d.errors.unresolved} 個錯誤仍未處理`, why: top ? `最多來自 ${top.source}（${top.count} 次）。` : '錯誤記錄累積中。', action: '先處理最多次嘅來源；如屬已停用功能，建議清理或停用相關頁面。' })
  }

  const slots = [...d.byPeriod].filter((x) => x.count > 0).sort((x, y) => x.revenue - y.revenue)
  if (slots.length >= 2 && t.revenue > 0) {
    const lowest = slots[0]
    if (lowest.revenue / t.revenue < 0.15) out.push({ priority: 'medium', category: '營運', title: `「${lowest.label}」時段收入偏低`, why: `只佔總收入 ${Math.round((lowest.revenue / t.revenue) * 100)}%（${hk(lowest.revenue)}）。`, action: '針對該時段推優惠碼或限時折扣，帶動空置時段。' })
  }
  const wd = [...d.weekday].sort((x, y) => x.revenue - y.revenue)
  if (t.revenue > 0 && wd[0].revenue === 0) out.push({ priority: 'low', category: '營運', title: `逢星期${wd[0].label}完全沒有收入`, why: '整個統計期內該日沒有已確認預約。', action: '考慮該日特別優惠，或確認該日是否有營業。' })

  const m = d.members
  const mc = pct(m.newCount, m.prevCount)
  if (mc !== null && mc <= -20) out.push({ priority: 'medium', category: '會員', title: `新會員較${d.prevLabel}同期減少 ${Math.abs(mc)}%`, why: `本期 ${m.newCount} 人，上期同期 ${m.prevCount} 人。`, action: '檢查註冊流程是否順暢，並考慮用電郵或 blog 推廣新會員禮遇。' })
  if (m.newCount > 0 && m.prevCount === 0) out.push({ priority: 'low', category: '會員', title: `本期新增 ${m.newCount} 位會員`, why: '上期同期沒有新會員記錄。', action: '向新會員發歡迎電郵，鼓勵第一次預約。' })

  if (t.revenue > 0 && t.promoDiscount / t.revenue > 0.15) out.push({ priority: 'medium', category: '收入', title: '優惠碼折扣佔收入比例偏高', why: `折扣 ${hk(t.promoDiscount)}，約佔收入 ${Math.round((t.promoDiscount / t.revenue) * 100)}%。`, action: '檢視各優惠碼成效，收緊使用次數或限期。' })

  if (out.length === 0) out.push({ priority: 'low', category: '營運', title: '本期沒有明顯異常', why: '收入、付款同系統指標都在正常範圍。', action: '可以用空閒時間做推廣：發電郵或更新 blog，累積 SEO 流量。' })
  const order: Record<Priority, number> = { high: 0, medium: 1, low: 2 }
  return out.sort((x, y) => order[x.priority] - order[y.priority]).slice(0, 6)
}
