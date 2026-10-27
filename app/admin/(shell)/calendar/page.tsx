import { getMonthDensity } from '@/lib/data/getAdminCalendar'
import SlotCalendar from '@/components/admin/SlotCalendar'
import { adminTokens as tokens } from '@/lib/admin/admin-tokens'

export default async function AdminCalendarPage() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  let days: Awaited<ReturnType<typeof getMonthDensity>> = []
  let loadError: string | null = null
  try {
    days = await getMonthDensity(year, month)
  } catch (err) {
    loadError = err instanceof Error ? err.message : '日曆資料載入失敗'
  }

  return (
    <div className="admin-stack">
      {loadError ? (
        <div
          role="alert"
          className="admin-empty"
          data-cms-key="admin.calendar.load_error"
          style={{ color: tokens.colors.danger ?? '#f87171', marginBottom: 16 }}
        >
          {loadError}
        </div>
      ) : null}
      <SlotCalendar initialYear={year} initialMonth={month} initialDays={days} />
    </div>
  )
}
