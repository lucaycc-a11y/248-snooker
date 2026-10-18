import Link from 'next/link'

/** One-tap links between the money-related admin pages. */
const LINKS = [
  { key: 'bookings', href: '/admin/bookings', label: '預約' },
  { key: 'revenue', href: '/admin/revenue', label: '收入' },
  { key: 'promos', href: '/admin/promos', label: '優惠碼' },
] as const

export default function AdminQuickLinks({ current }: { current: (typeof LINKS)[number]['key'] }) {
  return (
    <nav className="admin-row" aria-label="快捷連結" style={{ flexWrap: 'wrap', gap: 8 }}>
      {LINKS.filter((l) => l.key !== current).map((l) => (
        <Link key={l.key} href={l.href} className="admin-btn sm" data-cms-key={`admin.quicklink.${l.key}`}>
          {l.label}
        </Link>
      ))}
    </nav>
  )
}
