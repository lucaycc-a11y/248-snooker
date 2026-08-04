import { redirect } from 'next/navigation'

// The /member/history route is superseded by the "Bookings" tab in the main
// dashboard (app/member/MemberDashboard.tsx) which shows History inline.
export default function Page() {
  redirect('/member?tab=bookings')
}