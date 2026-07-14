'use client'

import { createContext, useContext } from 'react'

// Split from EditModeProvider.tsx so components that only need to READ
// edit-mode state (CMSText, EditableText, ContactButton, CMSList) can import
// this tiny context/hook without pulling in the provider's implementation
// (DOM manipulation, injected CSS) — keeping the module graph honest for the
// "non-admin visitors never load edit-mode JS" requirement, since the actual
// EditModeProvider component is only ever reached via a dynamic import gated
// on a confirmed-admin whoami check (see components/cms/CMSRoot.tsx).

export type EditModeContextValue = {
  editMode: boolean
  setEditMode: (v: boolean) => void
  adminRole: 'super_admin' | 'admin' | null
}

export const EditModeContext = createContext<EditModeContextValue | null>(null)

// Safe for non-admin contexts where EditModeProvider was never mounted —
// returns null instead of throwing, so callers (e.g. ContactButton) can
// branch with `useEditMode()?.editMode` without a provider-existence check.
export function useEditMode(): EditModeContextValue | null {
  return useContext(EditModeContext)
}
