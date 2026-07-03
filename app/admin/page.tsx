import { Card } from '@/components/ui/Card'
import { tokens } from '@/app/styles/tokens'
import { getAdminStats, getRevenueSeries, getLiveOccupancy } from '@/lib/data/getAdminStats'
import QuickActions from '@/components/admin/QuickActions'
import LiveOccupancy from '@/components/admin/LiveOccupancy'
import RevenueChart from '@/components/admin/RevenueChart'
import DashboardSummary from '@/components/admin/DashboardSummary'

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <div style={{ fontSize: 28, fontWeight: 700, color: tokens.colors.text }}>{value}</div>
      <div style={{ fontSize: 13, color: tokens.colors.textMuted, marginTop: 4 }}>{label}</div>
    </Card>
  )
}

function money(n: number): string {
  return `HK$${n.toLocaleString()}`
}

export default async function AdminDashboardPage() {
  const [stats, revenueSeries, occupancy] = await Promise.all([
    getAdminStats(),
    getRevenueSeries(30),
    getLiveOccupancy(),
  ])

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: tokens.colors.text, marginBottom: 24 }}>Dashboard</h1>

      <DashboardSummary />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: tokens.spacing.md,
          marginBottom: tokens.spacing.lg,
        }}
      >
        <StatCard label="Revenue today" value={money(stats.revenue.today)} />
        <StatCard label="Revenue this week" value={money(stats.revenue.week)} />
        <StatCard label="Revenue this month" value={money(stats.revenue.month)} />
        <StatCard label="Bookings today" value={String(stats.bookingsCount.today)} />
        <StatCard label="Table utilization" value={`${Math.round(stats.tableUtilization * 100)}%`} />
        <StatCard label="New members this week" value={String(stats.newMembers.week)} />
        <Card>
          <LiveOccupancy initial={occupancy} />
        </Card>
      </div>

      <Card style={{ marginBottom: tokens.spacing.lg }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: tokens.colors.text, marginBottom: tokens.spacing.md }}>
          Revenue (last 30 days)
        </div>
        <RevenueChart data={revenueSeries} />
      </Card>

      <QuickActions />
    </main>
  )
}
