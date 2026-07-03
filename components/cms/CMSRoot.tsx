'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { CMSProvider } from '@/lib/cms/useCMS'

// Root client boundary for the public site's CMS layer: opens the single
// Realtime subscription (CMSProvider) for everyone, and — ONLY for
// confirmed admins — dynamically imports the edit-mode bundle so non-admin
// visitors never download that JS at all.

const EditModeProvider = dynamic(
  () => import('@/components/cms/EditModeProvider').then((m) => m.EditModeProvider),
  { ssr: false }
)
const EditModeToggle = dynamic(() => import('@/components/cms/EditModeToggle'), { ssr: false })

type WhoAmI = { isAdmin: boolean; role?: 'super_admin' | 'admin' }

export default function CMSRoot({
  initialMap,
  locale,
  children,
}: {
  initialMap: Record<string, string>
  locale: string
  children: React.ReactNode
}) {
  const [who, setWho] = useState<WhoAmI | null>(null)

  useEffect(() => {
    fetch('/api/admin/whoami')
      .then((res) => (res.ok ? res.json() : { isAdmin: false }))
      .then((json: WhoAmI) => setWho(json))
      .catch(() => setWho({ isAdmin: false }))
  }, [])

  const body = <CMSProvider initialMap={initialMap} locale={locale}>{children}</CMSProvider>

  if (who?.isAdmin && who.role) {
    return (
      <EditModeProvider adminRole={who.role}>
        {body}
        <EditModeToggle />
      </EditModeProvider>
    )
  }

  return body
}
