'use client'

import Link from 'next/link'
import { tokens } from '@/app/styles/tokens'
import { useAdmin } from '@/lib/admin/AdminContext'

const linkStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '10px 18px',
  borderRadius: tokens.radius.button,
  border: `1px solid ${tokens.colors.borderStrong}`,
  color: tokens.colors.text,
  fontSize: 14,
  fontWeight: 600,
  textDecoration: 'none',
}

const primaryLinkStyle: React.CSSProperties = {
  ...linkStyle,
  backgroundColor: tokens.colors.brand,
  color: tokens.colors.brandText,
  border: 'none',
}

export default function QuickActions() {
  const admin = useAdmin()

  return (
    <div style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap' }}>
      <Link href="/admin/settings" style={linkStyle}>
        Edit settings
      </Link>
      <Link href="/admin/calendar" style={linkStyle}>
        View calendar
      </Link>
      {admin.role === 'super_admin' && (
        <Link href="/admin/team" style={primaryLinkStyle}>
          Invite admin
        </Link>
      )}
    </div>
  )
}
