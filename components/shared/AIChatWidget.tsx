'use client'

import { useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Sheet } from '@/components/ui/Sheet'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

/**
 * Floating AI chat button — same position/sizing as WhatsAppButton, but opens
 * an in-page chat panel instead of navigating away. Rendered by ContactButton
 * when contact_button_type = 'ai_chat'.
 */
export default function AIChatWidget() {
  const t = useTranslations('ai_chat')
  const [showTip, setShowTip] = useState(false)
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState(false)

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    const nextHistory = [...messages, { role: 'user' as const, content: text }]
    setMessages(nextHistory)
    setInput('')
    setSending(true)
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: messages }),
      })
      const json: unknown = await res.json().catch(() => null)
      const reply =
        json && typeof json === 'object' && 'reply' in json && typeof (json as { reply: unknown }).reply === 'string'
          ? (json as { reply: string }).reply
          : "Sorry, I couldn't reply — please try again."
      setMessages([...nextHistory, { role: 'assistant', content: reply }])
    } catch {
      setMessages([...nextHistory, { role: 'assistant', content: "Sorry, I couldn't reply — please try again." }])
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
                    backgroundColor: m.role === 'user' ? '#25D366' : 'rgba(255,255,255,0.08)',
                    color: m.role === 'user' ? '#000000' : '#FFFFFF',
                  }}
                >
                  {m.content}
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send()
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
              onClick={send}
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
