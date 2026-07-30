'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, X, Send } from 'lucide-react'
import { tokens } from '@/app/styles/tokens'

// Persistent admin AI panel — collapsible, docked to the bottom-right of every
// admin page (mounted once in app/admin/layout.tsx). Conversational, backed by
// /api/admin/ai/chat (live stats/revenue/occupancy context on every turn, see
// that route for what data the model can see). Distinct from AIChat.tsx, which
// is the CMS-text-editing tool, and from the customer-facing AIChatWidget,
// which carries booking-handoff/choice-button concepts that don't apply here.

type ChatMessage = { role: 'user' | 'assistant'; content: string; error?: boolean }

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

function renderReply(text: string) {
  return text.split('\n').map((line, i) => {
    const trimmed = line.trim()
    const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('• ')
    const content = isBullet ? trimmed.slice(2) : line
    return (
      <div key={i} style={{ display: 'flex', gap: isBullet ? 6 : 0 }}>
        {isBullet && <span aria-hidden="true">•</span>}
        <span>{renderInline(content, String(i))}</span>
      </div>
    )
  })
}

export default function AdminAIPanel() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || sending) return
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
      if (!res.ok) {
        const errorCode =
          json && typeof json === 'object' && 'error' in json && typeof (json as { error: unknown }).error === 'string'
            ? (json as { error: string }).error
            : null
        const message =
          errorCode === 'vectorengine_not_configured'
            ? "AI isn't set up yet — contact the site admin."
            : "Couldn't reply — please try again."
        setMessages([...nextHistory, { role: 'assistant', content: message, error: true }])
        return
      }
      const reply =
        json && typeof json === 'object' && 'reply' in json && typeof (json as { reply: unknown }).reply === 'string'
          ? (json as { reply: string }).reply
          : "Couldn't reply — please try again."
      setMessages([...nextHistory, { role: 'assistant', content: reply }])
    } catch {
      setMessages([...nextHistory, { role: 'assistant', content: 'Network error — please try again.', error: true }])
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2, ease: tokens.easing.spring }}
            style={{
              position: 'fixed',
              bottom: 88,
              right: 24,
              width: 360,
              maxWidth: 'calc(100vw - 32px)',
              height: 480,
              maxHeight: 'calc(100vh - 140px)',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: tokens.radius.card,
              border: `1px solid ${tokens.glassBg.border}`,
              background: `${tokens.colors.surface}`,
              backdropFilter: tokens.glass.prominent,
              WebkitBackdropFilter: tokens.glass.prominent,
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
              zIndex: 200,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderBottom: `1px solid ${tokens.colors.border}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bot size={18} style={{ color: tokens.colors.brand }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: tokens.colors.text }}>Admin Assistant</span>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: tokens.colors.textMuted, padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {messages.length === 0 && (
                <div style={{ fontSize: 13, color: tokens.colors.textMuted, lineHeight: 1.5 }}>
                  Ask about today&apos;s bookings, revenue trends, or table occupancy.
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '88%',
                    padding: '10px 14px',
                    borderRadius: tokens.radius.input,
                    fontSize: 13,
                    lineHeight: 1.5,
                    background: m.role === 'user' ? tokens.colors.brandDim : 'rgba(255,255,255,0.06)',
                    color: m.error ? tokens.colors.danger : tokens.colors.text,
                  }}
                >
                  {renderReply(m.content)}
                </div>
              ))}
              {sending && (
                <div style={{ fontSize: 13, color: tokens.colors.textMuted, alignSelf: 'flex-start' }}>Thinking…</div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: `1px solid ${tokens.colors.border}` }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') send(input)
                }}
                placeholder="Ask a question…"
                style={{
                  flex: 1,
                  height: 40,
                  padding: '0 14px',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${tokens.colors.border}`,
                  borderRadius: tokens.radius.pill,
                  color: tokens.colors.text,
                  fontSize: 16,
                  outline: 'none',
                }}
              />
              <button
                type="button"
                aria-label="Send"
                onClick={() => send(input)}
                disabled={sending || !input.trim()}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  border: 'none',
                  background: tokens.colors.brand,
                  color: tokens.colors.brandText,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: sending || !input.trim() ? 'default' : 'pointer',
                  opacity: sending || !input.trim() ? 0.5 : 1,
                  flexShrink: 0,
                }}
              >
                <Send size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        aria-label={open ? 'Close admin assistant' : 'Open admin assistant'}
        onClick={() => setOpen((v) => !v)}
        whileTap={{ scale: 0.94 }}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: `1px solid ${tokens.glassBg.border}`,
          background: tokens.colors.brand,
          color: tokens.colors.brandText,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(37,211,102,0.35)',
          zIndex: 200,
        }}
      >
        {open ? <X size={22} /> : <Bot size={22} />}
      </motion.button>
    </>
  )
}
