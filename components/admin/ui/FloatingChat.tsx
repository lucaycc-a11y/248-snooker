'use client'

import { useState } from 'react'
import {
  ArrowUp,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  Globe2,
  Maximize2,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Paperclip,
  Pencil,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from 'lucide-react'
import { IconButton } from './Button'
import AttachmentCard from './AttachmentCard'
import AIThinkingIndicator from './AIThinkingIndicator'
import SuggestionPanel from './SuggestionPanel'
import ModelSelector from './ModelSelector'
import PendingActionCard from './PendingActionCard'

type ChatPanelProps = {
  onCollapse: () => void
  onClose: () => void
}

function ChatPanel({ onCollapse, onClose }: ChatPanelProps) {
  const [thinking, setThinking] = useState(true)
  const [history, setHistory] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [model, setModel] = useState('Claude Opus 5')
  const [selected, setSelected] = useState('Which UI elements build trust in AI responses?')

  return (
    <div className="sg-chat-panel">
      <div className="sg-chat-status">
        Current page: Transactions · Filter: Today, Cancelled
      </div>
      <header className="sg-chat-header">
        <button className="sg-chat-title" onClick={() => setHistory((value) => !value)}>
          <MessageCircle size={16} strokeWidth={1.5} />
          New AI chat
          <ChevronDown size={14} strokeWidth={1.5} />
        </button>
        <div className="sg-chat-controls">
          <span>Personalize</span>
          <button className="sg-toggle is-on" aria-label="Personalize on"><i /></button>
          <IconButton label="Edit"><Pencil size={16} strokeWidth={1.5} /></IconButton>
          <IconButton label="Refresh"><RefreshCw size={16} strokeWidth={1.5} /></IconButton>
          <IconButton label="Copy"><Copy size={16} strokeWidth={1.5} /></IconButton>
          <IconButton label="Fullscreen"><Maximize2 size={16} strokeWidth={1.5} /></IconButton>
          <IconButton label="Close chat" className="sg-chat-close" onClick={onClose}>
            <X size={18} strokeWidth={1.5} />
          </IconButton>
        </div>
      </header>

      {history && (
        <div className="sg-history">
          <b>Recent conversations</b>
          <span>Project kickoff notes</span>
          <span>Revenue report summary</span>
          <span>Member trend analysis</span>
        </div>
      )}

      <div className="sg-chat-body">
        <div className="sg-attachments">
          <AttachmentCard long />
          <AttachmentCard />
        </div>
        <button className="sg-report-button">
          <FileText size={14} strokeWidth={1.5} />
          Get a detailed report
        </button>
        <AIThinkingIndicator />
        <button className="sg-thinking-toggle" onClick={() => setThinking((value) => !value)}>
          <ChevronRight size={16} strokeWidth={1.5} className={thinking ? 'is-open' : ''} />
          <b>Shaping the AI Chat Experience</b>
          <span>1:40</span>
          <ArrowUpRight size={14} strokeWidth={1.5} />
        </button>
        {thinking && (
          <p className="sg-thinking-copy">
            During the project review, the interface was presented as a modern, intuitive,
            and trustworthy experience that combines clarity with intelligent interaction.
            The most important detail is <mark>enhancing user confidence</mark> through
            clear status, accessible controls, and visual cues that make AI-driven
            responses easier to understand. This foundation supports a calmer, more
            useful workflow.
          </p>
        )}
        <SuggestionPanel selected={selected} onSelect={setSelected} />
      </div>

      <div className="sg-composer">
        <textarea placeholder="Ask AI anything" rows={2} />
        <div className="sg-composer-toolbar">
          <div>
            <IconButton label="Attach file"><Paperclip size={17} strokeWidth={1.5} /></IconButton>
            <ModelSelector model={model} open={modelOpen} onToggle={() => setModelOpen((value) => !value)} onSelect={(m) => { setModel(m); setModelOpen(false) }} />
            <IconButton label="Web search"><Globe2 size={17} strokeWidth={1.5} /></IconButton>
            <IconButton label="More options"><MoreHorizontal size={17} strokeWidth={1.5} /></IconButton>
          </div>
          <div>
            <IconButton label="Voice input"><Mic size={17} strokeWidth={1.5} /></IconButton>
            <button className="sg-send"><ArrowUp size={17} strokeWidth={1.5} /></button>
          </div>
        </div>
      </div>

      <button className="sg-collapse" aria-label="Collapse chat" onClick={onCollapse}>
        <ChevronDown size={14} strokeWidth={1.5} />
      </button>
    </div>
  )
}

export default function ChatShowcase() {
  const [open, setOpen] = useState(false)
  const [closed, setClosed] = useState(false)

  return (
    <section className="sg-section sg-ai-section">
      <div className="sg-section-heading">
        <div>
          <span className="sg-eyebrow">AI EXPERIENCE</span>
          <h2>A calm layer for complex work.</h2>
        </div>
        <span className="sg-mono sg-muted">MOCK ONLY</span>
      </div>
      <div className="sg-ai-showcase">
        {open && !closed && (
          <ChatPanel
            onCollapse={() => setOpen(false)}
            onClose={() => { setOpen(false); setClosed(true) }}
          />
        )}
        <PendingActionCard />
      </div>
      {!open && !closed && (
        <button className="sg-floating-chat" onClick={() => setOpen(true)} aria-label="Open AI chat">
          <Sparkles size={24} strokeWidth={1.5} />
          <i />
        </button>
      )}
      {closed && (
        <button className="sg-reset-chat" onClick={() => { setClosed(false); setOpen(true) }}>
          Reopen conversation
        </button>
      )}
    </section>
  )
}
