'use client'

/**
 * CouponTicket — SVG ticket-stub visual for coupon templates.
 *
 * Renders a perforated-edge ticket with:
 * - Dashed cut line (circular notch style)
 * - Discount value display
 * - Name / validity info
 * - CSS-variable only — no hardcoded colors
 *
 * Uses html-to-image (already installed) for PNG export.
 */

import { useRef, useCallback } from 'react'
import { toPng } from 'html-to-image'
import { Download } from 'lucide-react'

export type CouponTicketData = {
  name: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  validUntil: string | null
}

type CouponTicketProps = {
  data: CouponTicketData
  className?: string
  onExport?: (dataUrl: string) => void
}

export default function CouponTicket({ data, className, onExport }: CouponTicketProps) {
  const ticketRef = useRef<HTMLDivElement>(null)

  const handleExport = useCallback(async () => {
    if (!ticketRef.current) return
    try {
      const dataUrl = await toPng(ticketRef.current, {
        pixelRatio: 2,
        backgroundColor: 'transparent',
      })
      onExport?.(dataUrl)

      // Auto-download
      const link = document.createElement('a')
      link.download = `coupon-${data.name.replace(/\s+/g, '-').toLowerCase()}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('[CouponTicket] export failed', err)
    }
  }, [data.name, onExport])

  const displayValue =
    data.discountType === 'percentage' ? `${data.discountValue}%` : `$${data.discountValue}`

  const displayUnit = data.discountType === 'percentage' ? 'OFF' : 'HKD OFF'

  const expiry = data.validUntil
    ? new Date(data.validUntil).toLocaleDateString('en-HK', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'No expiry'

  return (
    <div className={className}>
      <div
        ref={ticketRef}
        className="relative flex overflow-hidden rounded-2xl"
        style={{
          background: 'var(--admin-surface-elevated)',
          border: '1px solid var(--admin-border)',
        }}
      >
        {/* ── Left: discount value ─────────────────────────── */}
        <div
          className="flex flex-col items-center justify-center px-6 py-5"
          style={{
            minWidth: 120,
            background: 'var(--admin-brand-dim)',
            borderRight: '2px dashed var(--admin-border-strong)',
          }}
        >
          <span
            className="text-3xl font-extrabold leading-none"
            style={{ color: 'var(--admin-brand)', fontFamily: 'var(--font-display, inherit)' }}
          >
            {displayValue}
          </span>
          <span
            className="mt-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--admin-text-muted)' }}
          >
            {displayUnit}
          </span>
        </div>

        {/* ── Right: details ───────────────────────────────── */}
        <div className="flex flex-1 flex-col justify-between px-5 py-4">
          <div>
            <p
              className="text-sm font-bold leading-tight"
              style={{ color: 'var(--admin-text)' }}
            >
              {data.name}
            </p>
            <p
              className="mt-1 text-xs"
              style={{ color: 'var(--admin-text-muted)' }}
            >
              Valid until {expiry}
            </p>
          </div>

          {/* Decorative scissors icon + dashed line */}
          <div className="mt-3 flex items-center gap-2">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--admin-text-faint)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="6" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <line x1="20" y1="4" x2="8.12" y2="15.88" />
              <line x1="14.47" y1="14.48" x2="20" y2="20" />
              <line x1="8.12" y1="8.12" x2="12" y2="12" />
            </svg>
            <div
              className="h-px flex-1"
              style={{
                borderTop: '1px dashed var(--admin-text-faint)',
              }}
            />
          </div>
        </div>

        {/* ── Circular notches (ticket perforation) ───────── */}
        <div
          className="pointer-events-none absolute -left-[7px] top-1/2 -translate-y-1/2"
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: 'var(--admin-bg)',
          }}
        />
        <div
          className="pointer-events-none absolute -right-[7px] top-1/2 -translate-y-1/2"
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: 'var(--admin-bg)',
          }}
        />
      </div>

      {/* Export button */}
      <button
        type="button"
        onClick={handleExport}
        className="mt-2 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
        style={{
          color: 'var(--admin-text-muted)',
          background: 'transparent',
          border: '1px solid var(--admin-border)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--admin-text)'
          e.currentTarget.style.borderColor = 'var(--admin-border-strong)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--admin-text-muted)'
          e.currentTarget.style.borderColor = 'var(--admin-border)'
        }}
      >
        <Download size={12} />
        Export PNG
      </button>
    </div>
  )
}
