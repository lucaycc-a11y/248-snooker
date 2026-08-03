import PromoCodesManager from '@/components/admin/PromoCodesManager'

export default function AdminPromosPage() {
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#FFFFFF', marginBottom: 24 }}>Promotions</h1>
      <PromoCodesManager />
    </main>
  )
}