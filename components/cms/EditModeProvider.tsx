'use client'

import { useEffect, useState } from 'react'
import { EditModeContext } from './EditModeContext'

// Public-site admin edit-mode state. Only ever mounted when whoami confirms
// the visitor is an admin (see the dynamic-import gate in CMSRoot.tsx) —
// non-admin visitors never load this module.

export function EditModeProvider({
  adminRole,
  children,
}: {
  adminRole: 'super_admin' | 'admin'
  children: React.ReactNode
}) {
  const [editMode, setEditMode] = useState(false)

  useEffect(() => {
    document.body.classList.toggle('cms-edit-mode', editMode)
    return () => document.body.classList.remove('cms-edit-mode')
  }, [editMode])

  return (
    <EditModeContext.Provider value={{ editMode, setEditMode, adminRole }}>
      {editMode && (
        <style>{`
          body.cms-edit-mode [data-cms-key] {
            outline: 1px dashed #25D366;
            outline-offset: 2px;
            cursor: text;
            position: relative;
          }
        `}</style>
      )}
      {children}
    </EditModeContext.Provider>
  )
}
