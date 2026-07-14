import { getMonthDensity } from '@/lib/data/getAdminCalendar'
import SlotCalendar from '@/components/admin/SlotCalendar'
import { tokens } from '@/app/styles/tokens'

export default async function AdminCalendarPage() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const days = await getMonthDensity(year, month)

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: tokens.colors.text, marginBottom: 24 }}>Calendar</h1>
      <SlotCalendar initialYear={year} initialMonth={month} initialDays={days} />
    </main>
  )
}
