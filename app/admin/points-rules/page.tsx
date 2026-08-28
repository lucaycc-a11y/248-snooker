import PointsRedemptionRulesManager from '@/components/admin/PointsRedemptionRulesManager'

export default function AdminPointsRulesPage() {
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#FFFFFF', marginBottom: 24 }}>Points Redemption Rules</h1>
      <PointsRedemptionRulesManager />
    </main>
  )
}
