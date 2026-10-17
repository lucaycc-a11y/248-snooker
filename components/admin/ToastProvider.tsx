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
import { Check, X } from 'lucide-react'

export type AdminToastInput = {
  message: string
  /**
   * Secondary line under the title — the prototype's `toast(t, s)` `s`, drawn
   * as the `small` element inside `.tt`. Optional.
   */
  detail?: string
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
      // Prototype `toast()`: 6500ms with undo, 4200ms without.
      const lifetime = input.onUndo ? 6500 : 4200
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
        <div className="admin-toasts">
          <div
            role="status"
            aria-live="polite"
            className={`admin-toast${toast.tone === 'error' ? ' bad' : ''}`}
          >
            <span className="admin-toast-tick" aria-hidden>
              {toast.tone === 'error' ? <X size={16} /> : <Check size={16} />}
            </span>

            <span className="admin-toast-tt">
              {toast.message}
              {toast.detail ? <small>{toast.detail}</small> : null}
            </span>

            {toast.onUndo && (
              <button
                type="button"
                onClick={handleUndo}
                className="admin-toast-undo"
                data-cms-key="admin.toast.undo"
              >
                還原
              </button>
            )}
          </div>
        </div>
      )}
    </AdminToastContext.Provider>
  )
}
