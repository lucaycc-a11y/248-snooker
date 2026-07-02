'use client'

import { createContext, useContext } from 'react'
import type { AdminData } from '@/lib/data/getAdmin'

const AdminContext = createContext<AdminData | null>(null)

export function AdminProvider({
  value,
  children,
}: {
  value: AdminData
  children: React.ReactNode
}) {
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}

export function useAdmin(): AdminData {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin() called outside AdminProvider')
  return ctx
}
