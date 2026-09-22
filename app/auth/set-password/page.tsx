import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { redirect } from 'next/navigation'
import { getServiceSupabase } from '@/lib/supabase/service'
import SetPasswordForm from './SetPasswordForm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Server component: checks if user is authenticated and actually needs to set password
export default async function SetPasswordPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {}, // Read-only
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Not logged in → redirect to login
  if (!user) {
    redirect('/login')
  }

  // Check if password is already set
  const service = getServiceSupabase()
  const { data: status } = await service
    .from('user_password_status')
    .select('password_set')
    .eq('user_id', user.id)
    .maybeSingle<{ password_set: boolean }>()

  // Password already set → redirect to member area
  if (status?.password_set) {
    redirect('/member')
  }

  return <SetPasswordForm userEmail={user.email ?? null} />
}
