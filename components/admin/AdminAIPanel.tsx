'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, X, Send, CheckCircle2, ChevronRight, Sparkles, Clock } from 'lucide-react'
import type { AIResponse, AIResponsePendingAction } from '@/lib/admin/aiSchema'
import { str } from '@/lib/data/adminReadHelpers'

/**
 * AI Chat Panel — §5.1 + §5.2 + §5.5.
 *
 * Desktop: slide-out 420px panel from right.
 * Mobile: full-screen overlay.
 *
 * Features:
 * - Structured JSON response rendering (summary/list/table/plain_text/pending_action)
 * - Pending action cards with confirm button + risk badge
 * - Rate limit indicator in header
 * - Thinking spinner with breathing glow
 */

// ── Types ──────────────────────────────────────────────────────────────────

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  structured?: AIResponse
  error?: boolean
  pendingAction?: AIResponsePendingAction
}

// ── Helpers ────────────────────────────────────────────────────────────────

function riskBadgeColor(level: 'low' | 'medium' | 'high'): string {
  if (level === 'high') return 'bg-red-500/15 text-red-400'
  if (level === 'medium') return 'bg-amber-500/15 text-amber-400'
  return 'bg-green-500/15 text-green-400'
}

// ── Structured response renderers ──────────────────────────────────────────

function SummaryRenderer({ content }: { content: string }) {
  return <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
}

function ListRenderer({ items }: { items: string[] }) {
  return (
    <ul className="text-sm leading-relaxed space-y-1.5 list-none p-0 m-0">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="text-[var(--green-500)] mt-0.5 shrink-0">•</span>
          <span className="whitespace-pre-wrap">{item}</span>
        </li>
      ))}
    </ul>
  )
}

function TableRenderer({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto -mx-1.5">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-[var(--border)]">
            {headers.map((h, i) => (
              <th
                key={i}
                className="text-left py-1.5 px-1.5 font-medium text-[var(--text-muted)] uppercase tracking-wider"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-[var(--border)] last:border-b-0">
              {row.map((cell, ci) => (
                <td key={ci} className="py-1.5 px-1.5">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PendingActionCard({ action }: { action: AIResponsePendingAction }) {
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = useCallback(async () => {
    setConfirming(true)
    setError(null)
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      // High-risk actions require explicit confirmation header
      if (action.riskLevel === 'high') {
        headers['x-confirm-high-risk'] = 'true'
      }
      const res = await fetch('/api/admin/actions/confirm', {
        method: 'POST',
        headers,
        body: JSON.stringify({ actionId: action.actionId }),
      })
      if (res.status === 428) {
        // High-risk needs second confirmation
        const data = await res.json()
        setError(data.message ?? 'High-risk action requires confirmation.')
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Failed to confirm action.')
        return
      }
      setConfirmed(true)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setConfirming(false)
    }
  }, [action])

  if (confirmed) {
    return (
      <div className="bg-[var(--green-500)]/10 border border-[var(--green-500)]/20 rounded-xl p-3">
        <div className="flex items-center gap-2 text-sm text-[var(--green-500)]">
          <CheckCircle2 size={16} />
          <span className="font-medium">Action confirmed</span>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-1">{action.targetSummary}</p>
      </div>
    )
  }

  return (
    <div className="bg-[var(--surface-elevated)] border border-[var(--border)] rounded-xl p-3 space-y-2">
      {/* Header with risk badge */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
          {action.actionType.replace('propose', '').replace(/([A-Z])/g, ' $1').trim()}
        </span>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${riskBadgeColor(action.riskLevel)}`}>
          {action.riskLevel}
        </span>
      </div>

      {/* Target summary */}
      <p className="text-sm leading-relaxed">{action.targetSummary}</p>

      {/* Changes table */}
      {action.changes.length > 0 && (
        <div className="space-y-1">
          {action.changes.map((change, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="text-[var(--text-muted)]">{change.field}:</span>
              <span className="line-through text-[var(--text-muted)]">{change.before}</span>
              <ChevronRight size={12} className="text-[var(--green-500)] shrink-0" />
              <span className="text-[var(--green-500)]">{change.after}</span>
            </div>
          ))}
        </div>
      )}

      {/* Reason */}
      {action.reason && (
        <p className="text-xs text-[var(--text-muted)] italic">{action.reason}</p>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {/* Confirm button */}
      <button
        type="button"
        onClick={handleConfirm}
        disabled={confirming}
        className="w-full py-2 rounded-xl text-sm font-medium transition-colors
          bg-[var(--green-500)] text-black hover:bg-[var(--green-400)]
          disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center justify-center gap-2"
      >
        {confirming ? (
          <>
            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            Confirming…
          </>
        ) : (
          <>
            <CheckCircle2 size={16} />
            Confirm {action.riskLevel === 'high' ? '(High Risk)' : ''}
          </>
        )}
      </button>
    </div>
  )
}

function StructuredResponse({ response }: { response: AIResponse }) {
  switch (response.type) {
    case 'summary':
      return <SummaryRenderer content={response.content} />
    case 'list':
      return <ListRenderer items={response.items} />
    case 'table':
      return <TableRenderer headers={response.headers} rows={response.rows} />
    case 'pending_action':
      return <PendingActionCard action={response} />
    case 'plain_text':
    default:
      return <SummaryRenderer content={response.content} />
  }
}

// ── Markdown-like bold rendering ───────────────────────────────────────────

const BOLD_RE = /(\*\*[^*]+\*\*)/g

function renderInline(text: string, keyPrefix: string) {
  return text.split(BOLD_RE).map((chunk, i) => {
    const key = `${keyPrefix}-${i}`
    if (chunk.startsWith('**') && chunk.endsWith('**')) {
      return <strong key={key}>{chunk.slice(2, -2)}</strong>
    }
    return <span key={key}>{chunk}</span>
  })
}

// ── Main component ─────────────────────────────────────────────────────────

export default function AdminAIPanel() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState(false)
  const [rateLimited, setRateLimited] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || sending || rateLimited) return

    const nextHistory = [...messages, { role: 'user' as const, content: trimmed }]
    setMessages(nextHistory)
    setInput('')
    setSending(true)

    try {
      const res = await fetch('/api/admin/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history: messages }),
      })

      const json: unknown = await res.json().catch(() => null)

      if (res.status === 429) {
        setRateLimited(true)
        setMessages([
          ...nextHistory,
          { role: 'assistant', content: 'Rate limited — please wait a moment before trying again.', error: true },
        ])
        // Reset rate limit after 60 seconds
        setTimeout(() => setRateLimited(false), 60000)
        return
      }

      if (!res.ok) {
        const fallback = "Couldn't reply — please try again."
        const errorMsg =
          json && typeof json === 'object'
            ? (str(json as Record<string, unknown>, ['error']) ?? fallback)
            : fallback
        setMessages([...nextHistory, { role: 'assistant', content: errorMsg, error: true }])
        return
      }

      // Parse structured response
      const response = json && typeof json === 'object' && 'response' in json
        ? (json as { response: AIResponse }).response
        : null

      if (!response) {
        setMessages([...nextHistory, { role: 'assistant', content: "Couldn't parse response.", error: true }])
        return
      }

      // Build assistant message
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: getPlainText(response),
        structured: response,
      }

      // If it's a pending action, also store it separately for the card
      if (response.type === 'pending_action') {
        assistantMsg.pendingAction = response
      }

      setMessages([...nextHistory, assistantMsg])
    } catch {
      setMessages([
        ...nextHistory,
        { role: 'assistant', content: 'Network error — please try again.', error: true },
      ])
    } finally {
      setSending(false)
    }
  }, [messages, sending, rateLimited])

  return (
    <>
      {/* ── Chat panel ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <>
            {/* Mobile: full-screen backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[199] lg:hidden"
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="fixed z-[200] flex flex-col overflow-hidden
                inset-0 lg:inset-auto
                lg:bottom-24 lg:right-6
                lg:w-[420px] lg:h-[560px] lg:max-h-[calc(100vh-140px)]
                lg:rounded-2xl lg:border lg:border-[var(--border)]
                bg-[var(--surface)]"
            >
              {/* ── Header ──────────────────────────────────────────────── */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[var(--green-500)]/15 flex items-center justify-center">
                    <Sparkles size={14} className="text-[var(--green-500)]" />
                  </div>
                  <span className="text-sm font-semibold text-[var(--text)]">AI Assistant</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Rate limit indicator */}
                  {rateLimited && (
                    <div className="flex items-center gap-1 text-xs text-amber-400">
                      <Clock size={12} />
                      <span>Rate limited</span>
                    </div>
                  )}
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => setOpen(false)}
                    className="p-1 rounded-lg hover:bg-[var(--surface-elevated)] text-[var(--text-muted)] transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* ── Messages ────────────────────────────────────────────── */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-3"
              >
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--green-500)]/10 flex items-center justify-center">
                      <Bot size={24} className="text-[var(--green-500)]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--text)]">Space8 AI Assistant</p>
                      <p className="text-xs text-[var(--text-muted)] mt-1 max-w-[240px]">
                        Ask about bookings, revenue, users, or request actions like cancelling a booking.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 justify-center max-w-[280px]">
                      {['Today\'s bookings', 'Revenue this week', 'Active users'].map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => send(q)}
                          className="text-[11px] px-2.5 py-1 rounded-full border border-[var(--border)]
                            text-[var(--text-muted)] hover:border-[var(--green-500)]/40 hover:text-[var(--green-500)]
                            transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[88%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed
                        ${m.role === 'user'
                          ? 'bg-[var(--green-500)]/15 text-[var(--text)] rounded-br-md'
                          : 'bg-[var(--surface-elevated)] text-[var(--text)] rounded-bl-md'
                        }
                        ${m.error ? 'text-red-400' : ''}
                      `}
                    >
                      {/* Render structured response or plain text */}
                      {m.structured ? (
                        <StructuredResponse response={m.structured} />
                      ) : m.role === 'assistant' ? (
                        <div className="space-y-1.5">
                          {m.content.split('\n').map((line, li) => (
                            <div key={li} className="flex items-start gap-1.5">
                              {line.trim().startsWith('- ') && (
                                <span className="text-[var(--green-500)] mt-0.5 shrink-0">•</span>
                              )}
                              <span className="whitespace-pre-wrap">
                                {renderInline(
                                  line.trim().startsWith('- ') ? line.slice(2) : line,
                                  `${i}-${li}`
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="whitespace-pre-wrap">{m.content}</span>
                      )}
                    </div>
                  </div>
                ))}

                {/* Thinking indicator */}
                {sending && (
                  <div className="flex justify-start">
                    <div className="bg-[var(--surface-elevated)] rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-[var(--green-500)] rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1.5 h-1.5 bg-[var(--green-500)] rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1.5 h-1.5 bg-[var(--green-500)] rounded-full animate-bounce" />
                      </div>
                      <span className="text-xs text-[var(--text-muted)]">Thinking…</span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Input bar ───────────────────────────────────────────── */}
              <div className="flex items-center gap-2 p-3 border-t border-[var(--border)]">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      send(input)
                    }
                  }}
                  placeholder={rateLimited ? 'Rate limited — wait a moment…' : 'Ask a question…'}
                  disabled={rateLimited}
                  className="flex-1 h-10 px-3.5 rounded-full bg-[var(--surface-elevated)] border border-[var(--border)]
                    text-sm text-[var(--text)] placeholder:text-[var(--text-muted)]
                    focus:outline-none focus:border-[var(--green-500)]/40
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors"
                />
                <button
                  type="button"
                  aria-label="Send"
                  onClick={() => send(input)}
                  disabled={sending || !input.trim() || rateLimited}
                  className="w-10 h-10 rounded-full bg-[var(--green-500)] text-black
                    flex items-center justify-center shrink-0
                    hover:bg-[var(--green-400)] transition-colors
                    disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send size={16} />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── FAB (floating action button) ────────────────────────────────── */}
      <motion.button
        type="button"
        aria-label={open ? 'Close admin assistant' : 'Open admin assistant'}
        onClick={() => setOpen((v) => !v)}
        whileTap={{ scale: 0.94 }}
        className="fixed bottom-6 right-6 z-[200] w-14 h-14 rounded-full
          bg-[var(--green-500)] text-black
          flex items-center justify-center
          shadow-[0_8px_24px_rgba(34,197,94,0.35)]
          hover:bg-[var(--green-400)] transition-colors"
      >
        {open ? <X size={22} /> : <Bot size={22} />}
      </motion.button>
    </>
  )
}

// ── Utility ────────────────────────────────────────────────────────────────

/** Extract plain text from any structured response for the message history. */
function getPlainText(response: AIResponse): string {
  switch (response.type) {
    case 'summary':
    case 'plain_text':
      return response.content
    case 'list':
      return response.items.join('\n')
    case 'table':
      return [response.headers.join(' | '), ...response.rows.map((r) => r.join(' | '))].join('\n')
    case 'pending_action':
      return `${response.actionType}: ${response.targetSummary}`
    default:
      return ''
  }
}
