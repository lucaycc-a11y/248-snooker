'use client'

import { useState, useEffect } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { Sheet } from '@/components/ui/Sheet'
import { Space8Loader } from '@/components/ui/Space8Loader'
import { tokens } from '@/app/styles/tokens'

const WHATSAPP_URL = 'https://wa.me/85264274620'
const EMAIL = 'info.formhk@gmail.com'

type ChatMessage = { role: 'user' | 'assistant'; content: string; handoff?: boolean; technicalError?: boolean; choice?: { question: string; options: string[] } }
type WidgetSettings = { greetingMessage: string; suggestedPrompts: string[] }

// Recognizes the AI's own /book?date=...&start=...&duration=...&table=... handoff
// link (see the system prompt in app/api/ai/chat/route.ts) inside otherwise plain
// reply text, and renders just that token as a real link.
const BOOK_LINK_RE = /(\/book\?[^\s)]+)/g
// **bold** spans — the system prompt asks the model for structured answers
// (bold + bullets), so this is a small, deliberately narrow markdown subset,
// not a general markdown renderer.
const BOLD_RE = /(\*\*[^*]+\*\*)/g

function renderInline(text: string, locale: string, keyPrefix: string) {
  return text.split(BOLD_RE).map((chunk, i) => {
    const key = `${keyPrefix}-${i}`
    if (chunk.startsWith('**') && chunk.endsWith('**')) {
      return <strong key={key}>{chunk.slice(2, -2)}</strong>
    }
    return chunk.split(BOOK_LINK_RE).map((part, j) =>
      part.startsWith('/book?') ? (
        <a
          key={`${key}-${j}`}
          href={locale === 'zh-HK' ? part : `/${locale}${part}`}
          style={{ color: tokens.colors.brand, textDecoration: 'underline', fontWeight: 600 }}
        >
          Book this slot
        </a>
      ) : (
        <span key={`${key}-${j}`}>{part}</span>
      )
    )
  })
}

function renderReplyContent(text: string, locale: string) {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    const trimmed = line.trim()
    const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('• ')
    const content = isBullet ? trimmed.slice(2) : line
    return (
      <div key={i} style={{ display: 'flex', gap: isBullet ? 6 : 0 }}>
        {isBullet && <span aria-hidden="true">•</span>}
        <span>{renderInline(content, locale, String(i))}</span>
      </div>
    )
  })
}

/**
 * Floating AI chat button — same position/sizing as WhatsAppButton, but opens
 * an in-page chat panel instead of navigating away. Rendered by ContactButton
 * as the permanent visitor default (Phase C).
 *
 * Rebuilt (Part 9) Intercom-Fin-style: a pre-chat "Home" screen with a
 * greeting + quick-reply chips (admin-configurable via /admin/ai-settings),
 * switching to the chat view on first send. Two-tier error handling:
 * vectorengine_not_configured -> generic technical message; a genuine
 * AI-can't-help response (server-signaled via {handoff:true}, see
 * app/api/ai/chat/route.ts's HANDOFF: sentinel) -> WhatsApp/email links.
 */
export default function AIChatWidget() {
  const t = useTranslations('ai_chat')
  const locale = useLocale()
  const [showTip, setShowTip] = useState(false)
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState(false)
  const [settings, setSettings] = useState<WidgetSettings | null>(null)

  const view: 'home' | 'chat' = messages.length === 0 ? 'home' : 'chat'

  useEffect(() => {
    let cancelled = false
    fetch('/api/ai/widget-settings?locale=' + locale)
      .then((res) => res.json())
      .then((json: WidgetSettings) => {
        if (!cancelled) setSettings(json)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [locale])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    const nextHistory = [...messages, { role: 'user' as const, content: trimmed }]
    setMessages(nextHistory)
    setInput('')
    setSending(true)
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history: messages, locale }),
      })
      const json: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        const errorCode =
          json && typeof json === 'object' && 'error' in json && typeof (json as { error: unknown }).error === 'string'
            ? (json as { error: string }).error
            : null
        const message =
          errorCode === 'vectorengine_not_configured'
            ? "I'm having a technical issue — please try again in a moment."
            : "Sorry, I couldn't reply — please try again."
        setMessages([...nextHistory, { role: 'assistant', content: message, technicalError: true }])
        return
      }
      if (json && typeof json === 'object' && (json as { type?: unknown }).type === 'choice') {
        const choiceJson = json as { question?: unknown; options?: unknown }
        const question = typeof choiceJson.question === 'string' ? choiceJson.question : ''
        const options = Array.isArray(choiceJson.options) ? choiceJson.options.filter((o): o is string => typeof o === 'string') : []
        setMessages([...nextHistory, { role: 'assistant', content: question, choice: { question, options } }])
        return
      }
      const reply =
        json && typeof json === 'object' && 'reply' in json && typeof (json as { reply: unknown }).reply === 'string'
          ? (json as { reply: string }).reply
          : "Sorry, I couldn't reply — please try again."
      const handoff = Boolean(json && typeof json === 'object' && 'handoff' in json && (json as { handoff: unknown }).handoff === true)
      setMessages([...nextHistory, { role: 'assistant', content: reply, handoff }])
    } catch {
      setMessages([...nextHistory, { role: 'assistant', content: "Sorry, I couldn't reply — please try again.", technicalError: true }])
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t('aria_label')}
        className="md:hidden"
        onTouchStart={() => setShowTip(true)}
        onTouchEnd={() => setShowTip(false)}
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 50,
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: '#25D366',
          color: '#000000',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <MessageCircle size={28} strokeWidth={2} color="#000000" />
        <span
          role="tooltip"
          className="glass-panel-dark"
          style={{
            position: 'absolute',
            right: '64px',
            top: '50%',
            transform: 'translateY(-50%)',
            whiteSpace: 'nowrap',
            color: '#FFFFFF',
            fontSize: '13px',
            fontWeight: 500,
            padding: '6px 12px',
            borderRadius: '999px',
            opacity: showTip ? 1 : 0,
            pointerEvents: 'none',
            transition: 'opacity 150ms ease',
          }}
        >
          {t('tooltip')}
        </span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '60vh', maxHeight: 480 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button
              onClick={() => setOpen(false)}
              aria-label={t('close')}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>

          {view === 'home' ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <Space8Loader size={48} theme="light" />
              <div style={{ fontSize: 15, color: '#FFFFFF', textAlign: 'center', fontWeight: 600 }}>
                {settings?.greetingMessage ?? '...'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                {(settings?.suggestedPrompts ?? []).map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => send(prompt)}
                    style={{
                      textAlign: 'left',
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: `1px solid ${tokens.colors.border}`,
                      background: 'rgba(37,211,102,0.08)',
                      color: '#FFFFFF',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12 }}>
              {messages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: 10,
                    textAlign: m.role === 'user' ? 'right' : 'left',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      maxWidth: '85%',
                      padding: '8px 12px',
                      borderRadius: 12,
                      fontSize: 14,
                      backgroundColor: m.role === 'user' ? '#25D366' : '#1A1A1A',
                      backgroundImage:
                        m.role === 'assistant'
                          ? 'linear-gradient(160deg, rgba(255,255,255,0.04) 0%, rgba(34,197,94,0.07) 100%)'
                          : undefined,
                      color: m.role === 'user' ? '#000000' : '#FFFFFF',
                    }}
                  >
                    {renderReplyContent(m.content, locale)}
                    {m.choice && m.choice.options.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {m.choice.options.map((opt, oi) => (
                          <button
                            key={oi}
                            onClick={() => send(opt)}
                            disabled={sending}
                            style={{
                              textAlign: 'left',
                              padding: '8px 12px',
                              borderRadius: 10,
                              border: `1px solid ${tokens.colors.border}`,
                              background: 'rgba(37,211,102,0.12)',
                              color: '#FFFFFF',
                              fontSize: 13,
                              cursor: sending ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                    {m.handoff && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <a
                          href={WHATSAPP_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: tokens.colors.brand, fontSize: 12, textDecoration: 'underline' }}
                        >
                          WhatsApp us
                        </a>
                        <a href={`mailto:${EMAIL}`} style={{ color: tokens.colors.brand, fontSize: 12, textDecoration: 'underline' }}>
                          Email us
                        </a>
                      </div>
                    )}
                  </span>
                </div>
              ))}
              {sending && (
                <div style={{ marginBottom: 10, textAlign: 'left' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderRadius: 12,
                      backgroundColor: '#1A1A1A',
                    }}
                  >
                    <Space8Loader size={18} theme="light" />
                  </span>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send(input)
              }}
              placeholder={t('placeholder')}
              style={{
                flex: 1,
                height: 44,
                padding: '0 14px',
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                color: '#FFFFFF',
                fontSize: 14,
              }}
            />
            <button
              onClick={() => send(input)}
              disabled={sending || !input.trim()}
              style={{
                height: 44,
                padding: '0 18px',
                backgroundColor: '#25D366',
                color: '#000000',
                border: 'none',
                borderRadius: 12,
                fontWeight: 700,
                cursor: sending ? 'not-allowed' : 'pointer',
                opacity: sending ? 0.6 : 1,
              }}
            >
              {t('send')}
            </button>
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
            AI Provided by FORM
          </div>
        </div>
      </Sheet>
    </>
  )
}
