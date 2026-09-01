'use client'

/**
 * SearchBar — §4.
 *
 * Pill-shaped global search with Cmd/Ctrl+K shortcut, 250ms debounce,
 * and grouped results dropdown. Zero results trigger AI fallback.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, ArrowRight, FileText, User, CreditCard, Sparkles } from 'lucide-react'

type SearchResult = {
  bookings: Array<Record<string, unknown>>
  users: Array<Record<string, unknown>>
  payments: Array<Record<string, unknown>>
  totalResults: number
  query: string
}

export default function SearchBar() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Keyboard shortcut: Cmd/Ctrl+K ───────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setIsOpen(true)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
        inputRef.current?.blur()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ── Click outside to close ───────────────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Debounced search ─────────────────────────────────────────────────────
  const fetchResults = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null)
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data)
      }
    } catch {
      // Silently fail — search is best-effort
    } finally {
      setIsSearching(false)
    }
  }, [])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setQuery(value)
      setIsOpen(true)

      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => fetchResults(value), 250)
    },
    [fetchResults]
  )

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // ── Navigation helpers ───────────────────────────────────────────────────
  const navigateToBooking = useCallback(
    (id: string) => {
      setIsOpen(false)
      setQuery('')
      router.push(`/admin/bookings?highlight=${id}`)
    },
    [router]
  )

  const navigateToUser = useCallback(
    (id: string) => {
      setIsOpen(false)
      setQuery('')
      router.push(`/admin/members/${id}`)
    },
    [router]
  )

  const navigateToPayment = useCallback(
    (bookingId: string) => {
      setIsOpen(false)
      setQuery('')
      router.push(`/admin/bookings?highlight=${bookingId}`)
    },
    [router]
  )

  // ── Helpers ──────────────────────────────────────────────────────────────
  function str(row: Record<string, unknown>, key: string): string {
    const v = row[key]
    return typeof v === 'string' ? v : ''
  }

  const hasResults = results && results.totalResults > 0
  const showAIFallback = results && results.totalResults === 0 && !isSearching

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      {/* Search input — pill shape */}
      <div className="relative">
        <Search
          size={16}
          strokeWidth={1.5}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)] pointer-events-none"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          placeholder="Search bookings, users, payments…"
          data-cms-key="search_placeholder"
          className="w-full h-10 pl-9 pr-20 rounded-full bg-[var(--admin-surface)] border border-[var(--admin-border)] text-sm text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)] focus:border-transparent transition-all"
        />
        {/* Keyboard shortcut badge */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setResults(null)
                setIsOpen(false)
                inputRef.current?.focus()
              }}
              className="p-1 rounded-full hover:bg-[var(--admin-surface-hover)] transition-colors"
              aria-label="Clear search"
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-[var(--admin-text-muted)] bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-md">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Results dropdown */}
      {isOpen && (query.length >= 2 || isSearching) && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl bg-[var(--admin-surface)] border border-[var(--admin-border)] shadow-lg backdrop-blur-xl z-50 max-h-[400px] overflow-y-auto">
          {/* Loading state */}
          {isSearching && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-[var(--admin-accent)] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Bookings section */}
          {!isSearching && results?.bookings && results.bookings.length > 0 && (
            <SearchSection
              icon={<FileText size={14} strokeWidth={1.5} />}
              title="Bookings"
              count={results.bookings.length}
            >
              {results.bookings.map((booking) => (
                <SearchItem
                  key={str(booking, 'id')}
                  primary={str(booking, 'human_code') || str(booking, 'booking_reference')}
                  secondary={`${str(booking, 'user_email')} · ${str(booking, 'date')}`}
                  onClick={() => navigateToBooking(str(booking, 'id'))}
                />
              ))}
              {results.totalResults > 3 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false)
                    router.push(`/admin/bookings?q=${encodeURIComponent(query)}`)
                  }}
                  className="flex items-center gap-1 px-3 py-2 text-xs text-[var(--admin-accent)] hover:bg-[var(--admin-surface-hover)] transition-colors w-full"
                >
                  View all bookings <ArrowRight size={12} strokeWidth={1.5} />
                </button>
              )}
            </SearchSection>
          )}

          {/* Users section */}
          {!isSearching && results?.users && results.users.length > 0 && (
            <SearchSection
              icon={<User size={14} strokeWidth={1.5} />}
              title="Users"
              count={results.users.length}
            >
              {results.users.map((user) => (
                <SearchItem
                  key={str(user, 'id')}
                  primary={str(user, 'display_name') || str(user, 'email')}
                  secondary={`${str(user, 'email')} · ${str(user, 'member_code')}`}
                  onClick={() => navigateToUser(str(user, 'id'))}
                />
              ))}
            </SearchSection>
          )}

          {/* Payments section */}
          {!isSearching && results?.payments && results.payments.length > 0 && (
            <SearchSection
              icon={<CreditCard size={14} strokeWidth={1.5} />}
              title="Payments"
              count={results.payments.length}
            >
              {results.payments.map((payment) => (
                <SearchItem
                  key={str(payment, 'id')}
                  primary={str(payment, 'provider_order_no') || str(payment, 'id').slice(0, 8)}
                  secondary={`HKD ${payment.amount ?? '–'} · ${str(payment, 'status')}`}
                  onClick={() => navigateToPayment(str(payment, 'booking_id'))}
                />
              ))}
            </SearchSection>
          )}

          {/* Zero results → AI fallback */}
          {showAIFallback && (
            <div className="px-4 py-6 text-center">
              <Sparkles size={20} strokeWidth={1.5} className="mx-auto mb-2 text-[var(--admin-accent)]" />
              <p className="text-sm text-[var(--admin-text-muted)] mb-3">
                No results found for &ldquo;{query}&rdquo;
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  // TODO: open AI panel with query pre-filled
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--admin-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Sparkles size={14} strokeWidth={1.5} />
                Ask AI
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SearchSection({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-[var(--admin-border)] last:border-b-0">
      <div className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wider">
        {icon}
        <span>{title}</span>
        <span className="ml-auto text-[10px] bg-[var(--admin-surface)] border border-[var(--admin-border)] rounded-full px-1.5 py-0.5">
          {count}
        </span>
      </div>
      <div>{children}</div>
    </div>
  )
}

function SearchItem({
  primary,
  secondary,
  onClick,
}: {
  primary: string
  secondary: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start px-4 py-2.5 hover:bg-[var(--admin-surface-hover)] transition-colors w-full text-left"
    >
      <span className="text-sm font-medium text-[var(--admin-text)] font-mono truncate max-w-full">
        {primary}
      </span>
      <span className="text-xs text-[var(--admin-text-muted)] truncate max-w-full">
        {secondary}
      </span>
    </button>
  )
}
