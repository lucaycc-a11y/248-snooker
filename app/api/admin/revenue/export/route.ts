/**
 * GET /api/admin/revenue/export — Excel workbook for the 收入 screen.
 *
 * Same query string as /api/admin/revenue and the same loader
 * (lib/data/getAdminRevenue.ts), so the file and the page cannot disagree.
 *
 * Sheets: 摘要 / 每日 / 付款方式 / 優惠碼 / 預約明細
 * Every money cell is a real number with the `HK$#,##0` format — never a
 * pre-formatted string — so Excel can sum the column. Dates are real Excel
 * dates. Header row is bold and frozen. 預約明細 is capped at
 * EXPORT_ROW_LIMIT and the 摘要 sheet states the cap when it bites.
 *
 * Writes one `revenue_export` row to audit_log. Throws if that insert fails
 * (writeAdminActionLog's contract) — a silent audit gap is not acceptable here.
 */

import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { getAdminData } from '@/lib/data/getAdmin'
import { getAdminRevenue } from '@/lib/data/getAdminRevenue'
import {
  EXPORT_ROW_LIMIT,
  REVENUE_DEFINITIONS_NOTE,
  type RevenueDetailRow,
} from '@/lib/admin/revenue-definitions'
import { writeAdminActionLog } from '@/lib/admin/audit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MONEY_FMT = 'HK$#,##0'
const DATE_FMT = 'yyyy-mm-dd'

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function compact(ymdDate: string): string {
  return ymdDate.replace(/-/g, '')
}

/** Real Excel date (UTC midnight) — ExcelJS writes it as a date cell. */
function excelDate(ymdDate: string): Date {
  return new Date(`${ymdDate}T00:00:00Z`)
}

function styleHeader(sheet: ExcelJS.Worksheet): void {
  const header = sheet.getRow(1)
  header.font = { bold: true }
  header.alignment = { vertical: 'middle' }
  // Freeze the header so the title row stays put while scrolling.
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columnCount },
  }
}

function setWidths(sheet: ExcelJS.Worksheet, widths: number[]): void {
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w
  })
}

const STATUS_LABELS: Record<string, string> = {
  confirmed: '已確認',
  pending: '待付款',
  awaiting_payment: '待付款',
  cancelled: '已取消',
  admin_cancelled: '管理員取消',
  refunded: '已退款',
  partly_refunded: '部分退款',
  completed: '已完成',
  failed: '失敗',
  no_show: '未到場',
}

export async function GET(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const toParam = url.searchParams.get('to')
    const fromParam = url.searchParams.get('from')

    const now = new Date()
    const hkNow = new Date(now.getTime() + 8 * 60 * 60 * 1000)
    const to = toParam ?? ymd(hkNow)
    const from = fromParam ?? `${hkNow.toISOString().slice(0, 7)}-01`
    const paymentMethodRaw = url.searchParams.get('paymentMethod')
    const paymentMethod = paymentMethodRaw && paymentMethodRaw !== 'all' ? paymentMethodRaw : null
    const includeTest = url.searchParams.get('includeTest') === 'true'
    const includeHidden = url.searchParams.get('includeHidden') === 'true'

    const result = await getAdminRevenue({
      from,
      to,
      paymentMethod,
      includeTest,
      includeHidden,
      allDetail: true,
    })
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    const truncated = result.detail.length > EXPORT_ROW_LIMIT
    const detailRows: RevenueDetailRow[] = truncated
      ? result.detail.slice(0, EXPORT_ROW_LIMIT)
      : result.detail

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Space8 後台'
    workbook.created = new Date()

    // ── 摘要 ────────────────────────────────────────────────────────────
    const summary = workbook.addWorksheet('摘要')
    summary.columns = [
      { header: '項目', key: 'label', width: 22 },
      { header: '數值', key: 'value', width: 18 },
      { header: '備註', key: 'note', width: 56 },
    ]
    styleHeader(summary)

    const t = result.totals
    const summaryRows: { label: string; value: number | string; note: string; money?: boolean }[] = [
      { label: '收入', value: t.revenue, note: '已確認預約的 total_price 總和（客戶實付）', money: true },
      { label: '預約數', value: t.bookingCount, note: 'status = confirmed' },
      { label: '平均每單', value: t.averagePerBooking, note: '收入 ÷ 預約數', money: true },
      { label: '退款', value: t.refund, note: 'refund_amount 總和', money: true },
      { label: '優惠碼折扣', value: t.promoDiscount, note: '已讓出，已含在收入內', money: true },
      { label: '積分折扣', value: t.pointsDiscount, note: '已讓出，已含在收入內', money: true },
      { label: 'Credit 折扣', value: t.creditDiscount, note: '已讓出，已含在收入內', money: true },
      { label: '淨收入', value: t.net, note: '收入 − 退款', money: true },
    ]
    for (const r of summaryRows) {
      const row = summary.addRow({ label: r.label, value: r.value, note: r.note })
      if (r.money) {
        row.getCell('value').numFmt = MONEY_FMT
      }
    }

    summary.addRow({})
    const metaLines: [string, string][] = [
      ['期間', `${from} 至 ${to}（香港時間）`],
      ['付款方式', paymentMethod ?? '全部'],
      ['包括測試預約', includeTest ? '是' : '否'],
      ['包括已隱藏帳戶', includeHidden ? '是' : '否'],
      ['對帳', `payment_attempts ${result.reconciliation.attemptsInRange} 筆，已連結 ${result.reconciliation.linkedToBooking} 筆，未連結 ${result.reconciliation.orphaned} 筆`],
      ['對帳備註', result.reconciliation.note],
      ['明細行數', truncated ? `已達上限 ${EXPORT_ROW_LIMIT} 行，只匯出首 ${EXPORT_ROW_LIMIT} 行（共 ${result.detail.length} 行）` : `${result.detail.length} 行`],
      ['匯出時間', new Date().toISOString()],
    ]
    for (const [label, value] of metaLines) {
      summary.addRow({ label, value, note: '' })
    }

    summary.addRow({})
    summary.addRow({ label: '計算方式', value: '', note: '' })
    for (const line of REVENUE_DEFINITIONS_NOTE.split('\n')) {
      summary.addRow({ label: '', value: '', note: line })
    }

    // ── 每日 ────────────────────────────────────────────────────────────
    const daily = workbook.addWorksheet('每日')
    daily.columns = [
      { header: '日期', key: 'date', width: 14 },
      { header: '收入', key: 'revenue', width: 14 },
      { header: '預約數', key: 'count', width: 10 },
      { header: '退款', key: 'refund', width: 14 },
    ]
    styleHeader(daily)
    for (const d of result.daily) {
      const row = daily.addRow({ date: excelDate(d.date), revenue: d.revenue, count: d.count, refund: d.refund })
      row.getCell('date').numFmt = DATE_FMT
      row.getCell('revenue').numFmt = MONEY_FMT
      row.getCell('refund').numFmt = MONEY_FMT
    }

    // ── 付款方式 ────────────────────────────────────────────────────────
    const methods = workbook.addWorksheet('付款方式')
    methods.columns = [
      { header: '付款方式', key: 'label', width: 20 },
      { header: '預約數', key: 'count', width: 10 },
      { header: '收入', key: 'revenue', width: 14 },
    ]
    styleHeader(methods)
    for (const b of result.byMethod) {
      const row = methods.addRow({ label: b.label, count: b.count, revenue: b.revenue })
      row.getCell('revenue').numFmt = MONEY_FMT
    }

    // ── 優惠碼 ──────────────────────────────────────────────────────────
    const promos = workbook.addWorksheet('優惠碼')
    promos.columns = [
      { header: '優惠碼', key: 'code', width: 18 },
      { header: '使用次數', key: 'uses', width: 12 },
      { header: '折扣金額', key: 'discount', width: 14 },
    ]
    styleHeader(promos)
    for (const p of result.promos) {
      const row = promos.addRow({ code: p.code, uses: p.uses, discount: p.totalDiscount })
      row.getCell('discount').numFmt = MONEY_FMT
    }

    // ── 預約明細 ────────────────────────────────────────────────────────
    const detail = workbook.addWorksheet('預約明細')
    detail.columns = [
      { header: '日期', key: 'date', width: 12 },
      { header: '時間', key: 'startTime', width: 10 },
      { header: '球桌', key: 'tableNumber', width: 8 },
      { header: '會員', key: 'memberName', width: 18 },
      { header: '會員編號', key: 'memberCode', width: 12 },
      { header: '電話', key: 'memberPhone', width: 14 },
      { header: '狀態', key: 'status', width: 12 },
      { header: '付款方式', key: 'paymentMethod', width: 14 },
      { header: '金額', key: 'amount', width: 12 },
      { header: '優惠碼', key: 'promoCode', width: 12 },
      { header: '優惠碼折扣', key: 'promoDiscount', width: 14 },
      { header: '退款', key: 'refundAmount', width: 12 },
      { header: '測試', key: 'isTest', width: 8 },
      { header: '已隱藏帳戶', key: 'isHiddenUser', width: 12 },
      { header: '預約編號', key: 'humanCode', width: 14 },
    ]
    styleHeader(detail)
    for (const r of detailRows) {
      const row = detail.addRow({
        date: excelDate(r.date),
        startTime: r.startTime,
        tableNumber: r.tableNumber ?? '',
        memberName: r.memberName ?? '',
        memberCode: r.memberCode ?? '',
        memberPhone: r.memberPhone ?? '',
        status: STATUS_LABELS[r.status] ?? r.status,
        paymentMethod: r.paymentMethod ?? '',
        amount: r.amount,
        promoCode: r.promoCode ?? '',
        promoDiscount: r.promoDiscount,
        refundAmount: r.refundAmount,
        isTest: r.isTest ? '是' : '否',
        isHiddenUser: r.isHiddenUser ? '是' : '否',
        humanCode: r.humanCode ?? '',
      })
      row.getCell('date').numFmt = DATE_FMT
      row.getCell('amount').numFmt = MONEY_FMT
      row.getCell('promoDiscount').numFmt = MONEY_FMT
      row.getCell('refundAmount').numFmt = MONEY_FMT
    }

    setWidths(summary, [22, 18, 56])

    const buffer = await workbook.xlsx.writeBuffer()
    const filename = `space8-revenue-${compact(from)}-${compact(to)}.xlsx`

    // Audit before responding — if this throws we return 500 rather than hand
    // over an export the audit log will never show.
    await writeAdminActionLog({
      adminUserId: admin.userId ?? null,
      adminEmail: admin.email,
      actionType: 'revenue_export',
      targetTable: 'bookings',
      targetId: null,
      beforeJsonb: null,
      afterJsonb: {
        from,
        to,
        paymentMethod,
        includeTest,
        includeHidden,
        revenue: t.revenue,
        bookingCount: t.bookingCount,
        net: t.net,
        detailRows: detailRows.length,
        truncated,
        filename,
      },
    })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[admin/revenue/export] GET error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
