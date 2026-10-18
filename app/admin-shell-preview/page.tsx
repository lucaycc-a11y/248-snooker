import { AdminShell } from '@/components/admin/AdminShell'
import TodayDashboard from '@/components/admin/TodayDashboard'
import BookingsPageClient from '@/components/admin/BookingsPageClient'
import MembersPageClient from '@/components/admin/MembersPageClient'
import type { AdminTodayData } from '@/lib/admin/today'
import type { AdminBookingRow } from '@/lib/data/getAdminBookings'
import type { AdminMemberRow } from '@/lib/data/getAdminMembers'
import type { AdminData } from '@/lib/data/getAdmin'
import '@/app/styles/admin-theme.css'

/**
 * Unauthenticated visual harness for the admin shell + 今日 dashboard.
 *
 * Sits outside app/admin/layout.tsx so it can be screenshotted without an
 * admin session, in the same spirit as /style-guide-preview. The rows below are
 * the prototype's own mock dataset (`space8-admin.html`, TODAY = 2026-10-07
 * 15:20) so the render can be diffed against /tmp/admin-ref/*.png one-for-one.
 *
 * Development only — it renders sample data and must never ship behaviour that
 * production depends on.
 */

export const dynamic = 'force-dynamic'

const DATA: AdminTodayData = {
  date: '2026-10-07',
  nowTime: '15:20',
  nowMinutes: 15 * 60 + 20,
  tableCount: 2,
  error: null,
  stats: { total: 5, live: 1, upcoming: 2, unpaid: 1 },
  week: [
    { date: '2026-10-04', count: 0, isToday: false },
    { date: '2026-10-05', count: 1, isToday: false },
    { date: '2026-10-06', count: 0, isToday: false },
    { date: '2026-10-07', count: 5, isToday: true },
    { date: '2026-10-08', count: 2, isToday: false },
    { date: '2026-10-09', count: 1, isToday: false },
    { date: '2026-10-10', count: 1, isToday: false },
  ],
  bookings: [
    {
      id: 'b1',
      humanCode: 'S8-261007-01',
      tableNumber: 1,
      date: '2026-10-07',
      startTime: '10:00',
      endTime: '12:00',
      durationHours: 2,
      price: 176,
      status: 'confirmed',
      isTest: false,
      userName: '陳家俊',
      userPhone: '6128 4501',
    },
    {
      id: 'b2',
      humanCode: 'S8-261007-02',
      tableNumber: 2,
      date: '2026-10-07',
      startTime: '13:00',
      endTime: '16:00',
      durationHours: 3,
      price: 294,
      status: 'confirmed',
      isTest: false,
      userName: '李美詩',
      userPhone: '5234 7712',
    },
    {
      id: 'b3',
      humanCode: 'S8-261007-03',
      tableNumber: 1,
      date: '2026-10-07',
      startTime: '16:00',
      endTime: '18:00',
      durationHours: 2,
      price: 196,
      status: 'confirmed',
      isTest: false,
      userName: '黃子軒',
      userPhone: '9345 2208',
    },
    {
      id: 'b4',
      humanCode: 'S8-261007-04',
      tableNumber: 2,
      date: '2026-10-07',
      startTime: '19:00',
      endTime: '23:00',
      durationHours: 4,
      price: 382,
      status: 'confirmed',
      isTest: false,
      userName: '張雅婷',
      userPhone: '6671 3390',
    },
    {
      id: 'b5',
      humanCode: 'S8-261007-05',
      tableNumber: 1,
      date: '2026-10-07',
      startTime: '20:00',
      endTime: '22:00',
      durationHours: 2,
      price: 216,
      status: 'pending',
      isTest: false,
      userName: '林俊樂',
      userPhone: '5560 9143',
    },
  ],
}

/**
 * Prototype `filterBk()` page-1 rows, scraped from the rendered 預約 list so
 * the harness pixels line up with /tmp/admin-ref/*-02-bookings.png.
 * `bookingReference` is the short code on top; `humanCode` is the `S8-…` line.
 */
const BOOKING_ROWS: AdminBookingRow[] = [
  { id: 'b1', humanCode: 'S8-261007-05', bookingReference: '6G85KP', userEmail: null, userName: '林俊樂', userPhone: '5560 9143', tableNumber: 1, date: '2026-10-07', startTime: '20:00', endTime: '22:00', price: 216, status: 'pending', paymentMethod: null, isTest: false },
  { id: 'b2', humanCode: 'S8-261010-10', bookingReference: 'XDHSGB', userEmail: null, userName: '吳思穎', userPhone: '5187 4436', tableNumber: 1, date: '2026-10-10', startTime: '11:00', endTime: '13:00', price: 186, status: 'confirmed', paymentMethod: null, isTest: false },
  { id: 'b3', humanCode: 'S8-261009-09', bookingReference: 'HVZ9SW', userEmail: null, userName: '陳家俊', userPhone: '6128 4501', tableNumber: 2, date: '2026-10-09', startTime: '19:00', endTime: '21:00', price: 216, status: 'confirmed', paymentMethod: null, isTest: false },
  { id: 'b4', humanCode: 'S8-261008-08', bookingReference: 'A5JAND', userEmail: null, userName: '梁浩然', userPhone: '6398 1024', tableNumber: 2, date: '2026-10-08', startTime: '14:00', endTime: '16:00', price: 96, status: 'confirmed', paymentMethod: null, isTest: false },
  { id: 'b5', humanCode: 'S8-261008-07', bookingReference: '7CJP8M', userEmail: null, userName: '何嘉怡', userPhone: '9012 6657', tableNumber: 1, date: '2026-10-08', startTime: '18:00', endTime: '21:00', price: 324, status: 'confirmed', paymentMethod: null, isTest: false },
  { id: 'b6', humanCode: 'S8-261007-04', bookingReference: 'KCGVXA', userEmail: null, userName: '張雅婷', userPhone: '6671 3390', tableNumber: 2, date: '2026-10-07', startTime: '19:00', endTime: '23:00', price: 382, status: 'confirmed', paymentMethod: null, isTest: false },
  { id: 'b7', humanCode: 'S8-261007-03', bookingReference: 'PG3RZN', userEmail: null, userName: '黃子軒', userPhone: '9345 2208', tableNumber: 1, date: '2026-10-07', startTime: '16:00', endTime: '18:00', price: 196, status: 'confirmed', paymentMethod: null, isTest: false },
  { id: 'b8', humanCode: 'S8-261006-17', bookingReference: '7ZNAJD', userEmail: null, userName: '梁浩然', userPhone: '6398 1024', tableNumber: 2, date: '2026-10-06', startTime: '15:00', endTime: '17:00', price: 196, status: 'payment_failed', paymentMethod: null, isTest: false },
]

const BOOKINGS: { bookings: AdminBookingRow[]; total: number; page: number; pageSize: number } = {
  bookings: BOOKING_ROWS,
  total: 16,
  page: 1,
  pageSize: 8,
}

/**
 * Prototype `DB.members` + the `ptsOf` / `credOf` figures rendered in
 * /tmp/admin-ref/*-08-members-grid.png. `needsManualPhoneReverify` is the
 * prototype's `reverify`; `credits` is the summed `DB.cred` balance;
 * `isPhoneVerified` is `m.verified`.
 */
const MEMBER_ROWS: AdminMemberRow[] = [
  { id: 'm1', memberCode: 'S80001', email: 'kc.chan@example.com', displayName: '陳家俊', phone: '6128 4501', tier: null, points: 512, credits: 0, needsManualPhoneReverify: false, isPhoneVerified: true, totalSpend: 0, bookingCount: 0, lastActiveAt: null, isBlacklisted: false, isHidden: false, createdAt: '2026-08-02' },
  { id: 'm2', memberCode: 'S80002', email: 'may.lee@example.com', displayName: '李美詩', phone: '5234 7712', tier: null, points: 294, credits: 50, needsManualPhoneReverify: false, isPhoneVerified: true, totalSpend: 0, bookingCount: 0, lastActiveAt: null, isBlacklisted: false, isHidden: false, createdAt: '2026-08-09' },
  { id: 'm3', memberCode: 'S80003', email: 'tszhin.w@example.com', displayName: '黃子軒', phone: '9345 2208', tier: null, points: 196, credits: 216, needsManualPhoneReverify: false, isPhoneVerified: true, totalSpend: 0, bookingCount: 0, lastActiveAt: null, isBlacklisted: false, isHidden: false, createdAt: '2026-08-15' },
  { id: 'm4', memberCode: 'S80004', email: 'ngaiting@example.com', displayName: '張雅婷', phone: '6671 3390', tier: null, points: 578, credits: 0, needsManualPhoneReverify: false, isPhoneVerified: true, totalSpend: 0, bookingCount: 0, lastActiveAt: null, isBlacklisted: false, isHidden: false, createdAt: '2026-08-21' },
  { id: 'm5', memberCode: 'S80005', email: 'jl.lam@example.com', displayName: '林俊樂', phone: '5560 9143', tier: null, points: 0, credits: 0, needsManualPhoneReverify: false, isPhoneVerified: true, totalSpend: 0, bookingCount: 0, lastActiveAt: null, isBlacklisted: false, isHidden: false, createdAt: '2026-09-03' },
  { id: 'm6', memberCode: 'S80006', email: 'karyi.ho@example.com', displayName: '何嘉怡', phone: '9012 6657', tier: null, points: 324, credits: 0, needsManualPhoneReverify: true, isPhoneVerified: false, totalSpend: 0, bookingCount: 0, lastActiveAt: null, isBlacklisted: false, isHidden: false, createdAt: '2026-09-11' },
  { id: 'm7', memberCode: 'S80007', email: null, displayName: '梁浩然', phone: '6398 1024', tier: null, points: 96, credits: 0, needsManualPhoneReverify: false, isPhoneVerified: true, totalSpend: 0, bookingCount: 0, lastActiveAt: null, isBlacklisted: false, isHidden: false, createdAt: '2026-09-18' },
  { id: 'm8', memberCode: 'S80008', email: 'sy.ng@example.com', displayName: '吳思穎', phone: '5187 4436', tier: null, points: 186, credits: 0, needsManualPhoneReverify: false, isPhoneVerified: true, totalSpend: 0, bookingCount: 0, lastActiveAt: null, isBlacklisted: false, isHidden: false, createdAt: '2026-09-25' },
  { id: 'm9', memberCode: 'S80009', email: 'kwok.ch@example.com', displayName: '郭晉豪', phone: '9650 3871', tier: null, points: 294, credits: 0, needsManualPhoneReverify: false, isPhoneVerified: true, totalSpend: 0, bookingCount: 0, lastActiveAt: null, isBlacklisted: true, isHidden: false, createdAt: '2026-09-29' },
]

/**
 * Stand-in for the server-resolved `getAdminData()` row. The harness is not
 * routed under /admin and has no session, but `AdminShell` mounts
 * `AdminProvider` unconditionally and `useAdmin()` throws without it.
 */
const PREVIEW_ADMIN: AdminData = {
  userId: '00000000-0000-0000-0000-000000000000',
  email: 'preview@example.com',
  role: 'super_admin',
  displayName: '預覽',
  themePreference: 'dark',
}

export default function AdminShellPreviewPage({
  searchParams,
}: {
  searchParams: { view?: string | string[] | undefined }
}) {
  const raw = searchParams.view
  const view = raw === 'bookings' ? 'bookings' : raw === 'members' ? 'members' : 'today'
  return (
    <AdminShell admin={PREVIEW_ADMIN} areaOverride={view} isSuperAdmin>
      {view === 'bookings' ? (
        <BookingsPageClient initial={BOOKINGS} preview />
      ) : view === 'members' ? (
        <MembersPageClient members={MEMBER_ROWS} preview isSuperAdmin />
      ) : (
        <TodayDashboard data={DATA} includeTest={false} />
      )}
    </AdminShell>
  )
}
