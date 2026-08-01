import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'

// Server Component. Verifies the invite token belongs to the currently signed
// in user's email (not just "some valid pending token") before activating the
// admin_users row — otherwise a forwarded invite link could be claimed by
// whoever opens it first, not the person who was actually invited.

type InviteLookup = { id: string; email: string; role: string }

async function acceptInvite(token: string, userId: string, userEmail: string): Promise<
  | { ok: true; role: string }
  | { ok: false; reason: 'invalid_or_expired' }
> {
  const service = getServiceSupabase()

  const { data } = await service
    .from('admin_users')
    .select('id, email, role')
    .eq('invite_token', token)
    .eq('invite_status', 'pending')
    .gt('invite_expires_at', new Date().toISOString())
    .maybeSingle()

  const invite = data as InviteLookup | null
  if (!invite || invite.email.toLowerCase() !== userEmail.toLowerCase()) {
    return { ok: false, reason: 'invalid_or_expired' }
  }

  const { error } = await service
    .from('admin_users')
    .update({ invite_status: 'active', user_id: userId, invite_token: null })
    .eq('id', invite.id)

  if (error) {
    console.error('[accept-invite] activation failed', error)
    return { ok: false, reason: 'invalid_or_expired' }
  }

  await service.from('audit_log').insert({
    admin_user_id: userId,
    admin_email: userEmail,
    action: 'admin_invite_accepted',
    target_table: 'admin_users',
    target_id: invite.id,
    after_value: { invite_status: 'active' },
  })

  return { ok: true, role: invite.role }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: '#000000',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>{children}</div>
    </main>
  )
}

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const tokenParam = params.token
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam

  if (!token) {
    return (
      <Shell>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Invalid invite link</h1>
      </Shell>
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const returnUrl = `/admin/accept-invite?${new URLSearchParams({ token }).toString()}`
    const loginHref = `/login?${new URLSearchParams({ returnUrl }).toString()}`
    return (
      <Shell>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Sign in to accept</h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginBottom: 24 }}>
          Sign in with the email this invite was sent to.
        </p>
        <a
          href={loginHref}
          style={{
            display: 'inline-block',
            backgroundColor: '#22c55e',
            color: '#000000',
            fontWeight: 700,
            fontSize: 15,
            textDecoration: 'none',
            padding: '14px 32px',
            borderRadius: 14,
          }}
        >
          Sign in
        </a>
      </Shell>
    )
  }

  if (!user.email) {
    return (
      <Shell>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
          This invite link is invalid or has expired. Please contact your admin.
        </h1>
      </Shell>
    )
  }

  const result = await acceptInvite(token, user.id, user.email)

  if (!result.ok) {
    return (
      <Shell>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
          This invite link is invalid or has expired. Please contact your admin.
        </h1>
      </Shell>
    )
  }

  return (
    <Shell>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>You&apos;re in</h1>
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginBottom: 24 }}>
        Your admin access ({result.role}) is now active.
      </p>
      <a
        href="/admin"
        style={{
          display: 'inline-block',
          backgroundColor: '#22c55e',
          color: '#000000',
          fontWeight: 700,
          fontSize: 15,
          textDecoration: 'none',
          padding: '14px 32px',
          borderRadius: 14,
        }}
      >
        Go to admin
      </a>
    </Shell>
  )
}
