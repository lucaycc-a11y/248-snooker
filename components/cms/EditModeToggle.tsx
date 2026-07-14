'use client'

import { useEditMode } from './EditModeContext'

// Small toggle for admins to flip public-site edit-mode on/off. Positioned
// away from ContactButton's bottom-right slot to avoid overlap (ContactButton
// itself becomes the "AI edit" entry point when edit-mode is on, replacing
// WhatsAppButton — see components/shared/ContactButton.tsx).
export default function EditModeToggle() {
  const ctx = useEditMode()
  if (!ctx) return null

  return (
    <button
      onClick={() => ctx.setEditMode(!ctx.editMode)}
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        zIndex: 50,
        height: '40px',
        padding: '0 16px',
        borderRadius: '999px',
        border: `1px solid ${ctx.editMode ? '#25D366' : 'rgba(255,255,255,0.2)'}`,
        backgroundColor: ctx.editMode ? 'rgba(37,211,102,0.15)' : 'rgba(0,0,0,0.6)',
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {ctx.editMode ? 'Editing' : 'Edit'}
    </button>
  )
}
