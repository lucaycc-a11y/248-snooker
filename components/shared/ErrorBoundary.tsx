"use client"

import { Component, type ReactNode } from "react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  sectionName?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * React Error Boundary to catch rendering crashes and prevent them from
 * breaking the entire page or silently failing navigation.
 *
 * Usage:
 *   <ErrorBoundary sectionName="Member Showcase">
 *     <Member />
 *   </ErrorBoundary>
 *
 * When a crash occurs:
 * - Shows a user-friendly fallback UI
 * - Logs error details to console
 * - Prevents silent navigation failures
 * - Isolates crashes to the wrapped section only
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(
      `[ErrorBoundary] Caught error in ${this.props.sectionName || "component"}:`,
      error,
      errorInfo
    )
    this.props.onError?.(error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <div
          style={{
            padding: "40px 24px",
            textAlign: "center",
            color: "#a1a1a6",
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
          }}
        >
          <p style={{ fontSize: 15, margin: 0 }}>
            {this.props.sectionName
              ? `${this.props.sectionName} 暫時無法顯示`
              : "此部分暫時無法顯示"}
          </p>
        </div>
      )
    }

    return this.props.children
  }
}
