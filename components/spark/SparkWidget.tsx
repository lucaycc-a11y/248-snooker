/**
 * Spark (Beta) — Main chat widget component (Admin-only)
 *
 * Floating chat interface mounted in admin layout.
 * Features:
 * - Persistent floating bubble (bottom-right)
 * - Message history
 * - Typing indicator
 * - WhatsApp CTA for escalations
 * - QR code delivery via tool
 * - Rate limit handling
 *
 * NOTE: Purple/pink gradient is intentional for admin-only beta signal.
 * If Spark becomes member-facing, revisit color scheme to match Space8 brand.
 */

'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageBubble } from './MessageBubble'
import { TypingIndicator } from './TypingIndicator'
import { X, Send } from 'lucide-react'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  showWhatsAppButton?: boolean
  toolResult?: {
    type: string
    data: { memberCode?: string }
  }
}

export function SparkWidget({ locale = 'zh-HK' }: { locale?: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [rateLimited, setRateLimited] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Greeting message (shown on first open)
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greetings = {
        'zh-HK': '你好，我是 Spark，Space8 的 AI 助手。有什麼可以協助你？',
        'zh-CN': '你好，我是 Spark，Space8 的 AI 助手。有什么可以协助你？',
        en: 'Hello, I am Spark, Space8\'s AI assistant. How can I help you?',
        ja: 'こんにちは、私は Spark、Space8 の AI アシスタントです。何かお手伝いできますか？',
      }
      setMessages([
        {
          id: 'greeting',
          role: 'assistant',
          content: greetings[locale as keyof typeof greetings] || greetings['zh-HK'],
        },
      ])
    }
  }, [isOpen, messages.length, locale])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  const sendMessage = async () => {
    if (!input.trim() || isLoading || rateLimited) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/spark/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          conversationId,
          locale,
        }),
      })

      if (response.status === 429) {
        setRateLimited(true)
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: 'Rate limit exceeded. Please wait a moment before sending another message.',
          },
        ])
        return
      }

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const data = await response.json()

      if (!conversationId && data.conversationId) {
        setConversationId(data.conversationId)
      }

      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.message,
        showWhatsAppButton: data.showWhatsAppButton || data.type === 'escalation',
        toolResult: data.toolResult,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('[Spark] Send error:', error)
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* Floating bubble */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-600 shadow-lg transition-all hover:scale-110 hover:from-purple-700 hover:to-pink-700"
          aria-label="Open Spark (Beta) chat"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3l1.912 5.813a2 2 0 001.272 1.275L21 12l-5.816 1.912a2 2 0 00-1.272 1.275L12 21l-1.912-5.813a2 2 0 00-1.272-1.275L3 12l5.816-1.912a2 2 0 001.272-1.275L12 3z" />
          </svg>
          {/* Beta badge */}
          <span className="absolute -right-1 -top-1 rounded-full bg-yellow-400 px-1.5 py-0.5 text-xs font-bold text-yellow-900">
            β
          </span>
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[600px] w-[400px] flex-col rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-600">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3l1.912 5.813a2 2 0 001.272 1.275L21 12l-5.816 1.912a2 2 0 00-1.272 1.275L12 21l-1.912-5.813a2 2 0 00-1.272-1.275L3 12l5.816-1.912a2 2 0 001.272-1.275L12 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Spark (Beta)</h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400">AI 助手</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
              aria-label="Close chat"
            >
              <X className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                showWhatsAppButton={msg.showWhatsAppButton}
                toolResult={msg.toolResult}
              />
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-neutral-200 p-4 dark:border-neutral-800">
            {rateLimited ? (
              <p className="text-center text-sm text-neutral-600 dark:text-neutral-400">已達速率限制，請稍後再試</p>
            ) : (
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="輸入訊息..."
                  className="flex-1 rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm outline-none focus:border-purple-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                  disabled={isLoading}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 text-white transition-opacity hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
