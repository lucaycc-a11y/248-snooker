import { getMonthDensity } from '@/lib/data/getAdminCalendar'
import SlotCalendar from '@/components/admin/SlotCalendar'
import { tokens } from '@/app/styles/tokens'

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
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: tokens.colors.text, marginBottom: 24 }}>日曆</h1>
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
    </main>
  )
}
