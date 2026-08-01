'use client'

import WhatsAppButton from './WhatsAppButton'

/**
 * Floating contact CTA — WhatsApp click-to-chat. Previously this slot could
 * swap to an admin-only "AI edit" widget when the (now-removed) CMS
 * edit-mode was active; that runtime-CMS editing layer has been deprecated
 * in favour of static next-intl content, so this always renders the
 * WhatsApp button now.
 */
export default function ContactButton() {
  return <WhatsAppButton />
}
