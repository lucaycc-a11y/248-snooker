import AIChat from '@/components/admin/AIChat'
import { tokens } from '@/app/styles/tokens'

export default function AdminCMSAIPage() {
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: tokens.colors.text, marginBottom: 24 }}>AI Content Assistant</h1>
      <AIChat />
    </main>
  )
}
