'use client'

// ────────────────────────────────────────────────────────────────
// AdminKPayErrorBoundary — crash fence around the admin KPay UI only.
//
// Scoped on purpose. It wraps <AdminKPayCheckout/> and nothing else, so
// a render error in the KPay dev UI is caught here and the public Stripe
// subtree (kept mounted behind it) keeps rendering. There is no
// componentWillUnmount-style cleanup that could touch Stripe state.
//
// The fallback always offers "Back to Stripe", which flips the parent's
// gateway state — the only way out of a crashed KPay tree.
// ────────────────────────────────────────────────────────────────

import { Component, type ReactNode } from 'react'
import { tokens } from '@/app/styles/tokens'

type Props = {
  children: ReactNode
  onBackToStripe: () => void
}

type State = {
  hasError: boolean
  message: string
}

export default class AdminKPayErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Unexpected error',
    }
  }

  componentDidCatch(error: unknown) {
    // Loud in the console only. This is an admin-only dev surface; there is
    // no user-facing telemetry path for it and inventing one would be scope.
    console.error('[AdminKPayCheckout] crashed', error)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        role="alert"
        style={{
          border: `1px solid ${tokens.colors.danger}`,
          borderRadius: tokens.radius.card,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.danger }}>
          KPay admin UI crashed
        </div>
        <div style={{ fontSize: 12.5, color: tokens.colors.textMuted, lineHeight: 1.5, wordBreak: 'break-word' }}>
          {this.state.message || 'Unexpected error'}
        </div>
        <div style={{ fontSize: 12.5, color: tokens.colors.textMuted, lineHeight: 1.5 }}>
          The public checkout is unaffected. Switch back to Stripe to continue.
        </div>
        <button
          type="button"
          onClick={this.props.onBackToStripe}
          style={{
            minHeight: 44,
            alignSelf: 'flex-start',
            padding: '0 16px',
            background: 'transparent',
            color: tokens.colors.text,
            border: `1px solid ${tokens.colors.borderStrong}`,
            borderRadius: tokens.radius.input,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Back to Stripe
        </button>
      </div>
    )
  }
}
