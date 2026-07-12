'use client'

import { useState, useEffect, useRef } from 'react'
import { MessageCircle, X, Clock, Star, MapPin, HelpCircle } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { Sheet } from '@/components/ui/Sheet'
import { LoadingGif } from '@/components/ui/LoadingGif'
import { Logo } from '@/components/brand/Logo'
import { tokens } from '@/app/styles/tokens'
import { useLiquidGlass } from '@/lib/useLiquidGlass'

const WHATSAPP_URL = 'https://wa.me/85264274620'
const EMAIL = 'info.formhk@gmail.com'

const GLASS_BORDER = 'rgba(255,255,255,0.18)'

// One small icon per quick-reply chip, cycling through a fixed set rather
// than requiring per-prompt icon config in /admin/ai-settings — the prompts
// there are freeform strings, so there's no reliable per-prompt category to
// map from.
const CHIP_ICONS = [Clock, Star, MapPin, HelpCircle]

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

  const chatGlassRootRef = useRef<HTMLDivElement>(null)
  useLiquidGlass(chatGlassRootRef, '.glass-chat-panel')

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
        <div ref={chatGlassRootRef} style={{ position: 'relative' }}>
          {/* Background gradient — positioned behind the glass panel as a sibling */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: tokens.radius.card,
              background: 'linear-gradient(160deg, rgba(10,10,20,0.6) 0%, rgba(6,20,14,0.6) 100%)',
              zIndex: 0,
              pointerEvents: 'none',
            }}
          />

          {/* Glass panel — direct child of root, WebGL shader applied by liquidglass */}
          <div
            className="glass-chat-panel"
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              flexDirection: 'column',
              height: '60vh',
              maxHeight: 480,
              padding: tokens.spacing.md,
              borderRadius: tokens.radius.card,
              border: `1px solid ${GLASS_BORDER}`,
              boxShadow: '0 0 40px rgba(34,197,94,0.08)',
            }}
          >
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
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
              <Logo variant="mark" theme="dark" size={64} />
              <div style={{ fontSize: 18, color: '#FFFFFF', textAlign: 'center', fontWeight: 700, lineHeight: 1.3, padding: '0 12px' }}>
                {settings?.greetingMessage ?? '...'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
                {(settings?.suggestedPrompts ?? []).map((prompt, i) => {
                  const Icon = CHIP_ICONS[i % CHIP_ICONS.length]
                  return (
                    <button
                      key={i}
                      onClick={() => send(prompt)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        textAlign: 'left',
                        padding: '12px 18px',
                        borderRadius: 100,
                        border: `1px solid ${tokens.colors.borderStrong}`,
                        background: 'transparent',
                        color: '#FFFFFF',
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: `background ${tokens.duration.fast} ${tokens.easing.standard}, border-color ${tokens.duration.fast} ${tokens.easing.standard}`,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = tokens.colors.brandDim
                        e.currentTarget.style.borderColor = tokens.colors.brand
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.borderColor = tokens.colors.borderStrong
                      }}
                    >
                      <Icon size={15} style={{ flexShrink: 0, color: tokens.colors.brand }} />
                      {prompt}
                    </button>
                  )
                })}
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
                      backgroundColor: m.role === 'user' ? tokens.colors.link : '#1A1A1A',
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
                              padding: '8px 14px',
                              borderRadius: tokens.radius.pill,
                              border: `1px solid ${tokens.colors.borderStrong}`,
                              background: 'transparent',
                              color: '#FFFFFF',
                              fontSize: 13,
                              fontWeight: 500,
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
                    <LoadingGif size={120} />
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
              onFocus={(e) => {
                e.currentTarget.style.borderColor = tokens.colors.brand
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = tokens.colors.border
              }}
              placeholder={t('placeholder')}
              style={{
                flex: 1,
                height: 48,
                padding: '0 16px',
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: `1px solid ${tokens.colors.border}`,
                borderRadius: tokens.radius.pill,
                color: '#FFFFFF',
                // 16px, not 14 — iOS Safari auto-zooms the viewport on focus
                // for any text input under 16px, which visibly jolts the page.
                fontSize: 16,
                outline: 'none',
                transition: `border-color ${tokens.duration.base} ${tokens.easing.standard}`,
              }}
            />
            <button
              onClick={() => send(input)}
              disabled={sending || !input.trim()}
              style={{
                height: 48,
                padding: '0 20px',
                backgroundColor: tokens.colors.link,
                color: '#000000',
                border: 'none',
                borderRadius: tokens.radius.pill,
                fontWeight: 700,
                cursor: sending ? 'not-allowed' : 'pointer',
                opacity: sending ? 0.6 : 1,
              }}
            >
              {t('send')}
            </button>
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: 'rgba(255,255,255,0.28)', textAlign: 'center' }}>
            AI Provided by FORM
          </div>
        </div>
        </div>
      </Sheet>
    </>
  )
}
