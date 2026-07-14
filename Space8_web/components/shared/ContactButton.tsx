'use client'

import WhatsAppButton from './WhatsAppButton'
import AIEditWidget from './AIEditWidget'
import { useEditMode } from '@/components/cms/EditModeContext'

/**
 * Merged floating contact CTA (Phase C). WhatsApp click-to-chat is the
 * permanent visitor default (replaces the AI chat widget — full replacement,
 * not dual-button). When an admin has edit-mode on, the same slot becomes an
 * "AI edit" entry point instead. useEditMode() returns null for non-admin
 * visitors (EditModeProvider was never mounted for them), so this safely
 * falls through to WhatsAppButton.
 */
export default function ContactButton() {
  const editModeCtx = useEditMode()
  if (editModeCtx?.editMode) return <AIEditWidget />
  return <WhatsAppButton />
}
