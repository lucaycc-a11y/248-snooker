'use client'

/**
 * Spark — the admin AI assistant, laid out like a chat app.
 * Left: past chats. Centre: the conversation (steps Spark took, cards, answer). Bottom: composer.
 * Spark can only propose changes; each one appears as a confirm card that the admin must press.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUp, Check, ChevronRight, History, Loader2, Menu, Plus, Square, Trash2, X } from 'lucide-react'
import AiText from '@/components/admin/AiText'
import { BlockView } from './SparkBlocks'
import type { SparkBlock, SparkStep } from '@/lib/spark/agent'

type UiMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  blocks: SparkBlock[]
  steps: SparkStep[]
  streaming?: boolean
  failed?: boolean
}
type ChatItem = { id: string; title: string; updated_at: string }

const SUGGESTIONS = [
  { title: '今日收入', text: '今日收入幾多？同上星期同日比較一下' },
  { title: '本月表現', text: '本月收入、預約數同每日走勢點樣？' },
  { title: '會員總覽', text: '有幾多會員？新會員有幾多已經預約？' },
  { title: '付款有冇問題', text: '最近 24 小時有冇客人付款失敗或者付了款但預約未確認？' },
  { title: '幫會員加 credit', text: '我想幫一位會員加 credit，請問我需要提供什麼資料？' },
  { title: '停用優惠碼', text: '列出現時生效中的優惠碼，我想停用其中一個' },
]

const isRec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diff <= 0 && d.getDate() === now.getDate()) return '今日'
  if (diff <= 1) return '昨日'
  if (diff < 7) return '本週'
  return '更早'
}

function StepTrace({ steps, live }: { steps: SparkStep[]; live: boolean }) {
  const hasError = steps.some((s) => s.status === 'error')
  const [open, setOpen] = useState(live)
  useEffect(() => {
    if (!live) setOpen(hasError)
  }, [live, hasError])
  if (steps.length === 0) return null
  const running = steps.some((s) => s.status === 'running')
  return (
    <div className="sp-trace">
      <button type="button" className="sp-trace-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <ChevronRight size={14} className={open ? 'open' : undefined} aria-hidden />
        <span>{running ? 'Spark 正在處理…' : `Spark 做了 ${steps.length} 個步驟`}</span>
      </button>
      {open ? (
        <ol className="sp-trace-list">
          {steps.map((s) => (
            <li key={s.id} className={s.status}>
              <span className="sp-trace-ic" aria-hidden>
                {s.status === 'running' ? <Loader2 size={13} className="sp-spin" /> : s.status === 'ok' ? <Check size={13} /> : <X size={13} />}
              </span>
              <span>{s.label}</span>
              {s.ms !== undefined ? <small className="admin-num">{s.ms < 1000 ? `${s.ms} ms` : `${(s.ms / 1000).toFixed(1)} s`}</small> : null}
              {s.detail ? <em>{s.detail}</em> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}

function Bubble({ m }: { m: UiMessage }) {
  if (m.role === 'user') {
    return (
      <div className="sp-row user">
        <div className="sp-user-bubble">{m.content}</div>
      </div>
    )
  }
  const thinking = m.streaming && m.content === '' && m.blocks.length === 0
  return (
    <div className="sp-row assistant">
      <span className="sp-avatar" aria-hidden>S</span>
      <div className="sp-answer">
        <StepTrace steps={m.steps} live={m.streaming === true} />
        {thinking && m.steps.length === 0 ? (
          <p className="sp-thinking" aria-live="polite"><i /><i /><i /></p>
        ) : null}
        {m.blocks.map((b, i) => (
          <BlockView key={b.type === 'action' ? b.action.id : `${b.type}-${i}`} block={b} />
        ))}
        {m.content !== '' ? (
          m.failed ? <p className="sp-error" role="alert">{m.content}</p> : <AiText text={m.content} />
        ) : null}
      </div>
    </div>
  )
}

export default function SparkChat({ adminName }: { adminName: string }) {
  const [chats, setChats] = useState<ChatItem[]>([])
  const [chatId, setChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadingChat, setLoadingChat] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const revealRef = useRef<number | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const loadChats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/spark/chats')
      const body: unknown = await res.json().catch(() => null)
      if (res.ok && isRec(body) && Array.isArray(body.chats)) setChats(body.chats as ChatItem[])
    } catch {
      /* the list is a convenience; the chat still works without it */
    }
  }, [])

  useEffect(() => {
    void loadChats()
    return () => {
      abortRef.current?.abort()
      if (revealRef.current) window.clearInterval(revealRef.current)
    }
  }, [loadChats])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 220
    if (nearBottom || busy) endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, busy])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }, [input])

  function newChat() {
    abortRef.current?.abort()
    if (revealRef.current) window.clearInterval(revealRef.current)
    setChatId(null)
    setMessages([])
    setBusy(false)
    setNotice(null)
    setDrawer(false)
    inputRef.current?.focus()
  }

  async function openChat(id: string) {
    if (busy) return
    setDrawer(false)
    setLoadingChat(true)
    setNotice(null)
    try {
      const res = await fetch(`/api/admin/spark/chats/${id}`)
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok || !isRec(body) || !Array.isArray(body.messages)) {
        setNotice('載入對話失敗')
        return
      }
      setChatId(id)
      setMessages(
        (body.messages as Record<string, unknown>[])
          .filter((m) => m.role === 'user' || (typeof m.content === 'string' && m.content !== '') || (Array.isArray(m.blocks) && m.blocks.length > 0))
          .map((m) => ({
            id: String(m.id),
            role: m.role === 'user' ? 'user' : 'assistant',
            content: typeof m.content === 'string' ? m.content : '',
            blocks: Array.isArray(m.blocks) ? (m.blocks as SparkBlock[]) : [],
            steps: Array.isArray(m.steps) ? (m.steps as SparkStep[]) : [],
          })),
      )
    } catch {
      setNotice('載入對話失敗')
    } finally {
      setLoadingChat(false)
    }
  }

  async function removeChat(id: string) {
    try {
      const res = await fetch(`/api/admin/spark/chats/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setChats((c) => c.filter((x) => x.id !== id))
        if (id === chatId) newChat()
      }
    } catch {
      setNotice('刪除失敗')
    }
  }

  function patchLast(fn: (m: UiMessage) => UiMessage) {
    setMessages((all) => (all.length === 0 ? all : [...all.slice(0, -1), fn(all[all.length - 1])]))
  }

  function reveal(full: string) {
    if (revealRef.current) window.clearInterval(revealRef.current)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || full.length < 40) {
      patchLast((m) => ({ ...m, content: full }))
      return
    }
    let n = 0
    const step = Math.max(3, Math.ceil(full.length / 45))
    revealRef.current = window.setInterval(() => {
      n = Math.min(full.length, n + step)
      patchLast((m) => ({ ...m, content: full.slice(0, n) }))
      if (n >= full.length && revealRef.current) {
        window.clearInterval(revealRef.current)
        revealRef.current = null
      }
    }, 16)
  }

  async function send(raw: string) {
    const text = raw.trim()
    if (!text || busy) return
    setInput('')
    setNotice(null)
    setBusy(true)
    const stamp = Date.now()
    setMessages((all) => [
      ...all,
      { id: `u${stamp}`, role: 'user', content: text, blocks: [], steps: [] },
      { id: `a${stamp}`, role: 'assistant', content: '', blocks: [], steps: [], streaming: true },
    ])
    const ctrl = new AbortController()
    abortRef.current = ctrl
    let finalText = ''
    try {
      const res = await fetch('/api/admin/spark/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message: text }),
        signal: ctrl.signal,
      })
      if (!res.ok || !res.body) {
        const body: unknown = await res.json().catch(() => null)
        const msg = isRec(body) && typeof body.error === 'string' ? body.error : 'Spark 暫時無法回應，請稍後再試。'
        patchLast((m) => ({ ...m, content: msg, streaming: false, failed: true }))
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        let idx = buf.indexOf('\n\n')
        while (idx !== -1) {
          const frame = buf.slice(0, idx)
          buf = buf.slice(idx + 2)
          idx = buf.indexOf('\n\n')
          if (!frame.startsWith('data: ')) continue
          let ev: unknown
          try {
            ev = JSON.parse(frame.slice(6))
          } catch {
            continue
          }
          if (!isRec(ev)) continue
          if (ev.type === 'meta' && typeof ev.chatId === 'string') setChatId(ev.chatId)
          else if (ev.type === 'step' && isRec(ev.step)) {
            const step = ev.step as unknown as SparkStep
            patchLast((m) => ({ ...m, steps: m.steps.some((s) => s.id === step.id) ? m.steps.map((s) => (s.id === step.id ? step : s)) : [...m.steps, step] }))
          } else if (ev.type === 'block' && isRec(ev.block)) {
            const block = ev.block as unknown as SparkBlock
            patchLast((m) => ({ ...m, blocks: [...m.blocks, block] }))
          } else if (ev.type === 'text' && typeof ev.text === 'string') {
            finalText = ev.text
            reveal(ev.text)
          } else if (ev.type === 'error' && typeof ev.message === 'string') {
            patchLast((m) => ({ ...m, content: String(ev.message), failed: true }))
          }
        }
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        patchLast((m) => ({ ...m, content: m.content || '連線中斷，請再試一次。', failed: m.content === '' }))
      }
    } finally {
      patchLast((m) => ({ ...m, streaming: false, content: finalText && !m.failed ? finalText : m.content }))
      setBusy(false)
      abortRef.current = null
      void loadChats()
    }
  }

  function stop() {
    abortRef.current?.abort()
  }

  const empty = messages.length === 0 && !loadingChat
  const groups = chats.reduce<Record<string, ChatItem[]>>((acc, c) => {
    const k = dayLabel(c.updated_at)
    ;(acc[k] ??= []).push(c)
    return acc
  }, {})

  return (
    <div className={`sp-app${drawer ? ' drawer' : ''}`}>
      <aside className="sp-side" aria-label="對話記錄">
        <button type="button" className="sp-new" onClick={newChat}>
          <Plus size={16} aria-hidden /> 新對話
        </button>
        <div className="sp-chats">
          {chats.length === 0 ? <p className="sp-muted">未有對話</p> : null}
          {['今日', '昨日', '本週', '更早'].filter((k) => groups[k]).map((k) => (
            <div key={k}>
              <p className="sp-group">{k}</p>
              <ul>
                {groups[k].map((c) => (
                  <li key={c.id} className={c.id === chatId ? 'active' : undefined}>
                    <button type="button" onClick={() => void openChat(c.id)} title={c.title}>{c.title}</button>
                    <button type="button" className="sp-del" aria-label="刪除對話" onClick={() => void removeChat(c.id)}>
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <Link href="/admin/spark/log" className="sp-log-link"><History size={15} aria-hidden /> 操作紀錄</Link>
      </aside>
      {drawer ? <button type="button" className="sp-scrim" aria-label="關閉" onClick={() => setDrawer(false)} /> : null}

      <section className="sp-main">
        <header className="sp-top">
          <button type="button" className="ad-icon-btn sp-menu" aria-label="對話記錄" onClick={() => setDrawer(true)}>
            <Menu size={18} aria-hidden />
          </button>
          <span className="sp-title"><b>Spark</b><small>by FORM</small></span>
          <button type="button" className="ad-icon-btn sp-menu" aria-label="新對話" onClick={newChat}>
            <Plus size={18} aria-hidden />
          </button>
        </header>

        <div className="sp-scroll" ref={scrollRef}>
          {loadingChat ? <p className="sp-muted center">載入中…</p> : null}
          {empty ? (
            <div className="sp-hello">
              <span className="sp-logo" aria-hidden>S</span>
              <h1>你好，{adminName}</h1>
              <p>我係 Spark。可以幫你查收入、會員、預約，亦可以提議更改（加 credit、取消預約、優惠碼…），每一項更改都要你確認，之後亦可還原。</p>
              <ul className="sp-suggest">
                {SUGGESTIONS.map((s) => (
                  <li key={s.title}>
                    <button type="button" onClick={() => void send(s.text)}>
                      <b>{s.title}</b>
                      <span>{s.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="sp-thread">
              {messages.map((m) => (
                <Bubble key={m.id} m={m} />
              ))}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <footer className="sp-composer">
          {notice ? <p className="sp-error" role="alert">{notice}</p> : null}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void send(input)
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              rows={1}
              placeholder="問 Spark…"
              aria-label="向 Spark 發問"
              maxLength={2000}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  void send(input)
                }
              }}
            />
            {busy ? (
              <button type="button" className="sp-send stop" onClick={stop} aria-label="停止">
                <Square size={14} fill="currentColor" aria-hidden />
              </button>
            ) : (
              <button type="submit" className="sp-send" disabled={input.trim() === ''} aria-label="發送">
                <ArrowUp size={18} aria-hidden />
              </button>
            )}
          </form>
          <p className="sp-fine">Spark 可能出錯，更改前請核對確認卡上的內容。所有操作都會記錄。</p>
        </footer>
      </section>
    </div>
  )
}
