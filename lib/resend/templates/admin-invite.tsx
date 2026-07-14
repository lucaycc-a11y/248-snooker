import * as React from 'react'

export type AdminInviteEmailProps = {
  inviteUrl: string
  role: 'admin' | 'super_admin'
}

// English only — recipient is being invited to staff tooling, not a customer
// flow, and admin UI/copy across this rebuild is deliberately hardcoded
// English (no CMS/i18n wiring for /admin).
export function AdminInviteEmail({ inviteUrl, role }: AdminInviteEmailProps) {
  return (
    <div
      style={{
        backgroundColor: '#000000',
        padding: '48px 24px',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
      }}
    >
      <table role="presentation" width="100%" style={{ maxWidth: '480px', margin: '0 auto' }}>
        <tbody>
          <tr>
            <td style={{ textAlign: 'center', paddingBottom: '32px' }}>
              <span
                style={{
                  color: '#22c55e',
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: '24px',
                  letterSpacing: '2px',
                }}
              >
                SPACE8
              </span>
            </td>
          </tr>
          <tr>
            <td style={{ backgroundColor: '#0a0a0a', borderRadius: '24px', padding: '40px 32px' }}>
              <h1
                style={{
                  color: '#ffffff',
                  fontSize: '22px',
                  fontWeight: 600,
                  margin: '0 0 8px',
                  textAlign: 'center',
                }}
              >
                You&apos;ve been invited to Space8 Admin
              </h1>
              <p style={{ color: '#a3a3a3', fontSize: '14px', textAlign: 'center', margin: '0 0 32px' }}>
                Role: {role === 'super_admin' ? 'Super Admin' : 'Admin'}
              </p>

              <div style={{ textAlign: 'center', margin: '0 0 24px' }}>
                <a
                  href={inviteUrl}
                  style={{
                    display: 'inline-block',
                    backgroundColor: '#22c55e',
                    color: '#000000',
                    fontSize: '15px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    padding: '14px 32px',
                    borderRadius: '14px',
                  }}
                >
                  Accept invite
                </a>
              </div>

              <p style={{ color: '#525252', fontSize: '13px', textAlign: 'center', margin: 0 }}>
                This link expires in 24 hours.
              </p>
            </td>
          </tr>

          <tr>
            <td style={{ textAlign: 'center', paddingTop: '24px' }}>
              <span style={{ color: '#525252', fontSize: '12px' }}>Space8 · Hong Kong</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
