'use client'

/**
 * ToastProvider — admin toast with optional undo (mockup `toast()`).
 *
 * Mounted once in AdminShell. Any client component under the shell can call
 * `useAdminToast().show({ message, onUndo })`. When `onUndo` is supplied the
 * toast shows an Undo button and stays up for 8s instead of 3s.
 *
 * CSS-variable only — no inline hex, no shadows.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Check, Undo2, X } from 'lucide-react'

export type AdminToastInput = {
  message: string
  tone?: 'success' | 'error'
  /** When present an Undo button is shown and the toast lives longer. */
  onUndo?: () => void | Promise<void>
}

type AdminToast = AdminToastInput & { id: number }

type AdminToastContextValue = {
  show: (input: AdminToastInput) => void
}

const AdminToastContext = createContext<AdminToastContextValue | null>(null)

export function useAdminToast(): AdminToastContextValue {
  const ctx = useContext(AdminToastContext)
  if (!ctx) {
    throw new Error('useAdminToast must be used inside <AdminToastProvider>')
  }
  return ctx
}

export function AdminToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<AdminToast | null>(null)
  const nextId = useRef(1)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismiss = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    setToast(null)
  }, [])

  const show = useCallback(
    (input: AdminToastInput) => {
      if (timer.current) clearTimeout(timer.current)
      const id = nextId.current++
      setToast({ ...input, id })
      // Undo affordances need a longer read window.
      const lifetime = input.onUndo ? 8000 : 3000
      timer.current = setTimeout(() => setToast(null), lifetime)
    },
    [],
  )

  const handleUndo = useCallback(async () => {
    if (!toast?.onUndo) return
    dismiss()
    try {
      await toast.onUndo()
    } catch (err) {
      console.warn('[toast] undo_failed', {
        message: err instanceof Error ? err.message : 'unknown',
      })
    }
  }, [toast, dismiss])

  const value = useMemo(() => ({ show }), [show])

  return (
    <AdminToastContext.Provider value={value}>
      {children}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-3 border px-4 py-3 md:bottom-6"
          style={{
            background: 'var(--admin-surface)',
            borderColor:
              toast.tone === 'error' ? 'var(--admin-danger)' : 'var(--admin-border)',
            color: 'var(--admin-text)',
            borderRadius: 'var(--admin-radius-card)',
            maxWidth: 'min(92vw, 28rem)',
          }}
        >
          {toast.tone === 'error' ? (
            <X size={14} style={{ color: 'var(--admin-danger)' }} aria-hidden />
          ) : (
            <Check size={14} style={{ color: 'var(--admin-brand)' }} aria-hidden />
          )}

          <span className="text-sm" style={{ color: 'var(--admin-text)' }}>
            {toast.message}
          </span>

          {toast.onUndo && (
            <button
              type="button"
              onClick={handleUndo}
              className="ml-auto inline-flex items-center gap-1 border px-2 py-1 text-xs font-semibold"
              style={{
                borderColor: 'var(--admin-border)',
                color: 'var(--admin-brand)',
                background: 'transparent',
                borderRadius: 'var(--admin-radius-btn)',
              }}
              data-cms-key="admin.toast.undo"
            >
              <Undo2 size={11} aria-hidden />
              復原
            </button>
          )}
        </div>
      )}
    </AdminToastContext.Provider>
  )
}
