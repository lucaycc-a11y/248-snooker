'use client'

/**
 * Admin QR Generator — §11.1.
 *
 * Input: booking reference or user ID → Output: QR code via qrcode.react.
 * Print-friendly layout with hidden controls when printing.
 * Design system: admin-theme.css variables only. NO inline hex, NO shadows, NO `any`.
 */

import { useState, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'

type LookupResult = {
  type: 'booking' | 'user'
  id: string
  reference: string
  detail: string
  url: string
}

/* ── Helpers ─────────────────────────────────────────── */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(row: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'string' && v.length > 0) return v
  }
  return null
}

export default function QRGeneratorPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<LookupResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleLookup = useCallback(async () => {
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch(`/api/admin/qr-lookup?q=${encodeURIComponent(q)}`)
      const data: unknown = await res.json()
      if (!res.ok || !isRecord(data)) {
        setError(isRecord(data) && typeof data.error === 'string' ? data.error : 'Lookup failed')
        return
      }
      if (isRecord(data) && typeof data.type === 'string' && typeof data.id === 'string') {
        setResult({
          type: data.type as 'booking' | 'user',
          id: data.id,
          reference: typeof data.reference === 'string' ? data.reference : data.id.slice(0, 8),
          detail: typeof data.detail === 'string' ? data.detail : '',
          url: typeof data.url === 'string' ? data.url : '',
        })
      } else {
        setError('Unexpected response format')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }, [query])

  const handlePrint = () => {
    window.print()
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 md:px-6 print:py-4">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="print:hidden">
        <h1
          className="text-2xl font-bold"
          style={{ color: 'var(--admin-text)' }}
          data-cms-key="admin_qr_generator_title"
        >
          QR Generator
        </h1>
        <p className="mt-1 text-xs" style={{ color: 'var(--admin-text-muted)' }}>
          Generate QR codes for bookings or member profiles.
        </p>
      </header>

      {/* ── Input ───────────────────────────────────────────── */}
      <div
        className="flex gap-2 rounded-2xl p-4 print:hidden"
        style={{
          background: 'var(--admin-surface)',
          border: '1px solid var(--admin-border)',
        }}
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleLookup() }}
          placeholder="Booking reference or user ID..."
          className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--admin-brand)]"
          style={{
            background: 'var(--admin-bg)',
            color: 'var(--admin-text)',
            borderColor: 'var(--admin-border)',
          }}
          data-cms-key="admin_qr_generator_input"
        />
        <button
          type="button"
          onClick={handleLookup}
          disabled={loading || !query.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
          style={{
            color: 'var(--admin-brand-text)',
            background: 'var(--admin-brand)',
            opacity: loading || !query.trim() ? 0.5 : 1,
          }}
        >
          {loading ? (
            <span className="admin-conic-spinner h-4 w-4" />
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          )}
          Lookup
        </button>
      </div>

      {/* ── Error ───────────────────────────────────────────── */}
      {error && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{
            color: 'var(--admin-danger)',
            background: 'var(--admin-danger-dim)',
            border: '1px solid var(--admin-danger)',
          }}
        >
          {error}
        </div>
      )}

      {/* ── QR Result ───────────────────────────────────────── */}
      {result && (
        <div
          className="flex flex-col items-center gap-6 rounded-2xl p-8 print:border-0 print:bg-transparent print:p-0 print:shadow-none"
          style={{
            background: 'var(--admin-surface)',
            border: '1px solid var(--admin-border)',
          }}
        >
          {/* QR Code */}
          <div
            className="rounded-2xl p-6"
            style={{ background: '#ffffff' }}
          >
            <QRCodeSVG
              value={result.url || result.reference}
              size={200}
              level="M"
              includeMargin={false}
              bgColor="#ffffff"
              fgColor="#000000"
            />
          </div>

          {/* Info */}
          <div className="flex flex-col items-center gap-2 text-center">
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase"
              style={{
                color: result.type === 'booking' ? 'var(--admin-brand)' : 'var(--admin-warning)',
                background: result.type === 'booking' ? 'var(--admin-brand-dim)' : 'var(--admin-warning-dim)',
              }}
            >
              {result.type}
            </span>
            <h2
              className="text-lg font-bold"
              style={{ color: 'var(--admin-text)' }}
            >
              {result.reference}
            </h2>
            {result.detail && (
              <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
                {result.detail}
              </p>
            )}
          </div>

          {/* Actions — hidden when printing */}
          <div className="flex gap-3 print:hidden">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
              style={{
                color: 'var(--admin-brand-text)',
                background: 'var(--admin-brand)',
              }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m0 0a48.159 48.159 0 018.5 0m-8.5 0V6.375a2.25 2.25 0 012.25-2.25h3.75a2.25 2.25 0 012.25 2.25v1.036" />
              </svg>
              Print
            </button>
            <button
              type="button"
              onClick={() => {
                setResult(null)
                setQuery('')
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              style={{
                color: 'var(--admin-text-muted)',
                background: 'var(--admin-surface-elevated)',
              }}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────── */}
      {!result && !error && !loading && (
        <div
          className="flex flex-col items-center justify-center py-16 text-center print:hidden"
          style={{ color: 'var(--admin-text-muted)' }}
        >
          <svg className="mb-4 h-12 w-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
          </svg>
          <p className="text-sm">
            Enter a booking reference or user ID to generate a QR code.
          </p>
        </div>
      )}
    </main>
  )
}
