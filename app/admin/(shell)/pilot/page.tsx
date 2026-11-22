import AdminPageHead from '@/components/admin/AdminPageHead'
import PilotLive from './PilotLive'

// Auth is enforced by app/admin/(shell)/layout.tsx.
export const dynamic = 'force-dynamic'

export default function AdminPilotPage() {
  return (
    <>
      <AdminPageHead sub="兩間房實時比分與剩餘時間，每 3 秒更新。可遠端結束比賽、響警報或加 10 分鐘（只加 iPad 計時，不影響預約）。" />
      <PilotLive />
    </>
  )
}
