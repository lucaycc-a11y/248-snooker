'use client'

import { useTranslations } from 'next-intl'
import { SITE_CONTACT } from '@/lib/site/contact'

// Phone/email are read-only for members; changes go through WhatsApp support
// and are applied by an admin (docs/admin-identity-change.md).
export function IdentityLockedNote() {
  const t = useTranslations('memberPage')
  return (
    <p className="mt-1 text-xs text-white/40" data-cms-key="memberPage.settings_identity_locked_note">
      {t('settings_identity_locked_note')}{' '}
      <a
        href={SITE_CONTACT.whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#22c55e] underline"
        data-cms-key="memberPage.settings_identity_locked_link"
      >
        {t('settings_identity_locked_link')}
      </a>
    </p>
  )
}
