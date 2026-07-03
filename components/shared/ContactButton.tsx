'use client'

import AIChatWidget from './AIChatWidget'
import AIEditWidget from './AIEditWidget'
import { useEditMode } from '@/components/cms/EditModeContext'

/**
 * Merged floating contact CTA (Phase C). AI chat is now the permanent
 * visitor default (replaces the old contact_button_type CMS toggle from
 * Phase 6 — removed per the user's decision to merge, not keep both). When
 * an admin has edit-mode on, the same slot becomes an "AI edit" entry point
 * instead. useEditMode() returns null for non-admin visitors (EditModeProvider
 * was never mounted for them), so this safely falls through to AIChatWidget.
 */
export default function ContactButton() {
  const editModeCtx = useEditMode()
  if (editModeCtx?.editMode) return <AIEditWidget />
  return <AIChatWidget />
}
