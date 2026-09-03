'use client'

import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Bell,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  Clipboard,
  Code2,
  Copy,
  Ellipsis,
  Expand,
  FileText,
  Filter,
  Globe2,
  Grid2X2,
  History,
  LayoutGrid,
  Lightbulb,
  Maximize2,
  Menu,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings,
  Sparkles,
  SunMoon,
  TrendingDown,
  TrendingUp,
  Upload,
  UserRound,
  X,
  Zap,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import Logo from './Logo'

type Theme = 'dark' | 'light'
type WidgetSize = '1x1' | '2x1' | '1x2' | '2x2'

type Widget = { id: string; title: string; size: WidgetSize; kind: 'number' | 'line' | 'ring' | 'bars' | 'ai' }

const widgets: Widget[] = [
  { id: 'ai', title: 'AI Insights', size: '2x1', kind: 'ai' },
  { id: 'balance', title: 'Balance Overview', size: '1x1', kind: 'line' },
  { id: 'earnings', title: 'Earnings', size: '1x1', kind: 'ring' },
  { id: 'transactions', title: 'Transactions', size: '2x1', kind: 'number' },
  { id: 'spending', title: 'Spending', size: '1x1', kind: 'bars' },
]

const navItems = [
  { label: 'Dashboard', icon: LayoutGrid },
  { label: 'Accounts', icon: Clipboard },
  { label: 'Transactions', icon: RefreshCw },
  { label: 'Reports', icon: ArrowUpRight },
  { label: 'Investments', icon: TrendingUp },
  { label: 'Loans', icon: Code2 },
  { label: 'Taxes', icon: FileText },
]

const transactions = [
  ['PlayStation', '•••• 0224', '31 Mar, 3:20 PM', '$19.99', 'var(--status-warning)'],
  ['Netflix', '•••• 0224', '29 Mar, 5:11 PM', '$30.00', 'var(--status-danger)'],
  ['Airbnb', '•••• 4432', '29 Mar, 1:20 PM', '$300.00', 'var(--green-bright)'],
  ['Tommy C.', '•••• 0224', '27 Mar, 2:31 AM', '+$27.00', 'var(--green-bright)'],
  ['Apple', '•••• 4432', '27 Mar, 11:04 PM', '$10.00', 'var(--green)'],
]

function IconButton({ label, children, className = '', onClick }: { label: string; children: React.ReactNode; className?: string; onClick?: () => void }) {
  return <button aria-label={label} onClick={onClick} className={`sg-icon-button ${className}`}>{children}</button>
}

function PillButton({ children, primary = false, danger = false, className = '' }: { children: React.ReactNode; primary?: boolean; danger?: boolean; className?: string }) {
  return <button className={`sg-pill-button ${primary ? 'is-primary' : ''} ${danger ? 'is-danger' : ''} ${className}`}>{children}</button>
}

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`sg-glass-card ${className}`}><div className="sg-glass-orb" />{children}</section>
}

function StatCard({ title, value, trend, children }: { title: string; value: string; trend?: string; children: React.ReactNode }) {
  return <section className="sg-card sg-stat-card">
    <div className="sg-card-heading"><h3>{title}</h3><IconButton label={`Open ${title}`}><ArrowUpRight size={16} strokeWidth={1.5} /></IconButton></div>
    <div className="sg-value-row"><strong className="sg-mono sg-money">{value}</strong>{trend && <span className="sg-trend"><TrendingUp size={14} strokeWidth={1.5} />{trend}</span>}</div>
    {children}
  </section>
}

function LineChart() {
  return <div className="sg-line-chart" aria-label="Balance trend mock chart">
    <svg viewBox="0 0 320 90" preserveAspectRatio="none" role="img" aria-label="Balance trend">
      <defs><linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--green)" stopOpacity=".24" /><stop offset="1" stopColor="var(--green)" stopOpacity="0" /></linearGradient></defs>
      <path d="M0 56 C28 53 34 76 64 66 S108 77 132 70 S164 66 190 54 S224 30 242 42 S276 30 320 35 L320 90 L0 90Z" fill="url(#lineFill)" />
      <path d="M0 56 C28 53 34 76 64 66 S108 77 132 70 S164 66 190 54 S224 30 242 42 S276 30 320 35" fill="none" stroke="var(--green-bright)" strokeWidth="2" />
      <circle cx="242" cy="42" r="4" fill="var(--bg-elevated)" stroke="var(--green-bright)" strokeWidth="2" />
    </svg><span className="sg-chart-callout">+$320</span><div className="sg-axis sg-mono"><span>16</span><span>17</span><span>18</span><span>19</span><span>20</span><span>21</span><span>22</span><span>23</span></div>
  </div>
}

function RingChart() {
  return <div className="sg-ring-wrap"><div className="sg-ring"><div><small>Percentage</small><strong>58%</strong></div></div><div className="sg-legend"><span><i className="sg-dot is-green" />Current</span><span><i className="sg-dot is-muted" />Month goal</span></div></div>
}

function BarChart() {
  return <div className="sg-bars">{[['34%', 'Clothing'], ['16%', 'Groceries'], ['8%', 'Pets'], ['6%', 'Bills']].map(([amount, label], index) => <div className="sg-bar-column" key={label}><span>{amount}</span><div className={`sg-bar sg-bar-${index}`} /><small>{label}</small></div>)}<div className="sg-more-icons"><IconButton label="Clothing"><UserRound size={16} strokeWidth={1.5} /></IconButton><IconButton label="Groceries"><Grid2X2 size={16} strokeWidth={1.5} /></IconButton><IconButton label="Pets"><Zap size={16} strokeWidth={1.5} /></IconButton><span>+8 more</span></div></div>
}

function TransactionsCard() {
  return <section className="sg-card sg-transactions"><div className="sg-card-heading"><h3>Transactions</h3><div className="sg-heading-actions"><IconButton label="Filter transactions"><Filter size={16} strokeWidth={1.5} /></IconButton><IconButton label="Expand transactions"><ArrowUpRight size={16} strokeWidth={1.5} /></IconButton></div></div><div className="sg-transaction-list">{transactions.map(([name, account, date, amount, color]) => <div className="sg-transaction" key={name}><span className="sg-merchant-icon" style={{ background: color }}><CircleUserRound size={14} strokeWidth={1.5} /></span><div><strong>{name}</strong><small className="sg-mono">{account}</small></div><time>{date}</time><b className="sg-mono" style={{ color }}>{amount}</b></div>)}</div></section>
}

function WidgetBody({ widget }: { widget: Widget }) {
  if (widget.kind === 'ai') return <GlassCard className="sg-ai-insights"><span className="sg-label"><Sparkles size={13} strokeWidth={1.5} />AI Insights</span><div className="sg-ai-copy"><span className="sg-carousel-dots"><i /><i /><i /><i /></span><p>Your transaction volume has increased by <b>5%</b><br />since last month</p><IconButton label="Open insight"><ArrowUpRight size={16} strokeWidth={1.5} /></IconButton></div></GlassCard>
  if (widget.kind === 'line') return <StatCard title="Balance Overview" value="$17,241.00" trend="12% From last month"><div className="sg-pills"><span><RefreshCw size={12} strokeWidth={1.5} />44 transactions</span><span><Grid2X2 size={12} strokeWidth={1.5} />12 categories</span></div><LineChart /></StatCard>
  if (widget.kind === 'ring') return <StatCard title="Earnings" value="$6,400.00" trend="7% From last month"><RingChart /></StatCard>
  if (widget.kind === 'bars') return <StatCard title="Spending" value="$2,000.00"><span className="sg-downtrend"><TrendingDown size={14} strokeWidth={1.5} />2% From last month</span><BarChart /></StatCard>
  return <TransactionsCard />
}

function DashboardShowcase({ theme, onThemeChange }: { theme: Theme; onThemeChange: () => void }) {
  const [ordered, setOrdered] = useState(widgets)
  const [dragged, setDragged] = useState<string | null>(null)
  const moveWidget = (target: string) => {
    if (!dragged || dragged === target) return
    const from = ordered.findIndex((item) => item.id === dragged)
    const to = ordered.findIndex((item) => item.id === target)
    const next = [...ordered]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    setOrdered(next)
    setDragged(null)
  }
  return <div className="sg-dashboard-shell">
    <aside className="sg-sidebar"><Logo /><div className="sg-welcome"><div className="sg-welcome-top"><span className="sg-avatar">G</span><div><IconButton label="Toggle theme" onClick={onThemeChange}><SunMoon size={16} strokeWidth={1.5} /></IconButton><IconButton label="Settings"><Settings size={16} strokeWidth={1.5} /></IconButton></div></div><small>MONDAY, MARCH 24</small><p>Welcome back,<br /><b>George!</b></p></div><nav>{navItems.map(({ label, icon: NavIcon }, index) => <button className={index === 0 ? 'is-active' : ''} key={label}><NavIcon size={16} strokeWidth={1.5} />{label}</button>)}</nav><div className="sg-promo"><Sparkles size={18} strokeWidth={1.5} /><div><b>Activate SPACE8 Pro</b><small>Elevate your work with AI</small></div></div></aside>
    <main className="sg-main"><header className="sg-topbar"><PillButton><Calendar size={14} strokeWidth={1.5} />This Month</PillButton><div className="sg-top-search"><Search size={16} strokeWidth={1.5} /><span>Search dashboard...</span></div><div className="sg-top-actions"><PillButton><Grid2X2 size={14} strokeWidth={1.5} />Manage Widgets</PillButton><PillButton primary><Plus size={14} strokeWidth={1.5} />Add new Widget</PillButton></div></header><div className="sg-widget-grid">{ordered.map((widget) => <div key={widget.id} draggable onDragStart={() => setDragged(widget.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => moveWidget(widget.id)} className={`sg-widget sg-size-${widget.size} ${dragged === widget.id ? 'is-dragging' : ''}`}><WidgetBody widget={widget} /></div>)}</div><section className="sg-section"><div className="sg-section-heading"><div><span className="sg-eyebrow">SYSTEM TOKENS</span><h2>Visual language, made tangible.</h2></div><span className="sg-mono sg-muted">1x1 · 2x1 · 1x2 · 2x2</span></div><div className="sg-token-row"><div className="sg-card sg-token-card"><span className="sg-eyebrow">STATUS DOTS</span><div className="sg-status-list"><span><i className="sg-dot is-green" />Success</span><span><i className="sg-dot is-warning" />Warning</span><span><i className="sg-dot is-danger" />Danger</span><span><i className="sg-dot is-muted" />Pending</span></div></div><GlassCard className="sg-demo-glass"><span className="sg-eyebrow">LIQUID GLASS</span><h3>Blur creates hierarchy.</h3><p>Translucent surfaces are reserved for AI and contextual layers.</p></GlassCard><div className="sg-card sg-token-card"><span className="sg-eyebrow">BUTTONS</span><div className="sg-button-list"><PillButton primary><Check size={14} strokeWidth={1.5} />Primary</PillButton><PillButton>Secondary</PillButton><PillButton danger>Danger</PillButton></div></div></div></section></main>
  </div>
}

function AttachmentCard({ long = false }: { long?: boolean }) { return <div className="sg-attachment"><span className="sg-attachment-icon"><Calendar size={18} strokeWidth={1.5} /></span><div><small>Onboarding Meeting</small><strong title={long ? 'Project Kickoff Meeting — Space8 Admin Dashboard' : undefined}>{long ? 'Project Kickoff Meeting — Space8…' : 'Design Review Notes'}</strong></div><time>Dec 16, 2025</time></div> }

function AIThinkingIndicator() { return <div className="sg-thinking-indicator"><span className="sg-thinking-orb" /> <span>Getting a detailed report...</span></div> }

function ChatPanel({ onCollapse, onClose }: { onCollapse: () => void; onClose: () => void }) {
  const [thinking, setThinking] = useState(true)
  const [history, setHistory] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [model, setModel] = useState('Claude Opus 5')
  const [selected, setSelected] = useState('Which UI elements build trust in AI responses?')
  return <div className="sg-chat-panel"><div className="sg-chat-status">Current page: Transactions · Filter: Today, Cancelled</div><header className="sg-chat-header"><button className="sg-chat-title" onClick={() => setHistory((value) => !value)}><MessageCircle size={16} strokeWidth={1.5} />New AI chat<ChevronDown size={14} strokeWidth={1.5} /></button><div className="sg-chat-controls"><span>Personalize</span><button className="sg-toggle is-on" aria-label="Personalize on"><i /></button><IconButton label="Edit"><Pencil size={16} strokeWidth={1.5} /></IconButton><IconButton label="Refresh"><RefreshCw size={16} strokeWidth={1.5} /></IconButton><IconButton label="Copy"><Copy size={16} strokeWidth={1.5} /></IconButton><IconButton label="Fullscreen"><Maximize2 size={16} strokeWidth={1.5} /></IconButton><IconButton label="Close chat" className="sg-chat-close" onClick={onClose}><X size={18} strokeWidth={1.5} /></IconButton></div></header>{history && <div className="sg-history"><b>Recent conversations</b><span>Project kickoff notes</span><span>Revenue report summary</span><span>Member trend analysis</span></div>}<div className="sg-chat-body"><div className="sg-attachments"><AttachmentCard long /><AttachmentCard /></div><button className="sg-report-button"><FileText size={14} strokeWidth={1.5} />Get a detailed report</button><AIThinkingIndicator /><button className="sg-thinking-toggle" onClick={() => setThinking((value) => !value)}><ChevronRight size={16} strokeWidth={1.5} className={thinking ? 'is-open' : ''} /><b>Shaping the AI Chat Experience</b><span>1:40</span><ArrowUpRight size={14} strokeWidth={1.5} /></button>{thinking && <p className="sg-thinking-copy">During the project review, the interface was presented as a modern, intuitive, and trustworthy experience that combines clarity with intelligent interaction. The most important detail is <mark>enhancing user confidence</mark> through clear status, accessible controls, and visual cues that make AI-driven responses easier to understand. This foundation supports a calmer, more useful workflow.</p>}<div className="sg-suggestion-panel"><div className="sg-suggestion-hints"><span>↑↓ to navigate <i>·</i> ↵ to select</span><span>esc to close</span></div><div className="sg-suggestions"><button>→ <span>How should AI show uncertainty?</span></button><button className="is-selected" onClick={() => setSelected('Which UI elements build trust in AI responses?')}>→ <span>Which UI elements build trust in AI responses?</span></button><button>→ <span>What signals make AI responses feel reliable?</span></button></div><div className="sg-selected-prompt"><RotateCcw size={14} strokeWidth={1.5} /><span>{selected}</span><X size={14} strokeWidth={1.5} /></div></div></div><div className="sg-composer"><textarea placeholder="Ask AI anything" rows={2} /><div className="sg-composer-toolbar"><div><IconButton label="Attach file"><Paperclip size={17} strokeWidth={1.5} /></IconButton><div className="sg-model-wrap"><button className="sg-model-button" onClick={() => setModelOpen((value) => !value)}><Sparkles size={14} strokeWidth={1.5} />{model}<ChevronDown size={12} strokeWidth={1.5} /></button>{modelOpen && <div className="sg-model-menu"><button onClick={() => { setModel('Claude Opus 5'); setModelOpen(false) }}>Claude Opus 5</button><button onClick={() => { setModel('Claude Sonnet 5'); setModelOpen(false) }}>Claude Sonnet 5</button></div>}</div><IconButton label="Web search"><Globe2 size={17} strokeWidth={1.5} /></IconButton><IconButton label="More options"><MoreHorizontal size={17} strokeWidth={1.5} /></IconButton></div><div><IconButton label="Voice input"><Mic size={17} strokeWidth={1.5} /></IconButton><button className="sg-send"><ArrowUp size={17} strokeWidth={1.5} /></button></div></div></div><button className="sg-collapse" aria-label="Collapse chat" onClick={onCollapse}><ChevronDown size={14} strokeWidth={1.5} /></button></div>
}

function PendingAction() { return <section className="sg-pending"><div className="sg-card-heading"><span className="sg-eyebrow">PENDING ACTION</span><span className="sg-pending-dot" /></div><div className="sg-pending-grid"><span>Field</span><span>Old value</span><span>New value</span><b>Status</b><span>Draft</span><strong>Confirmed</strong></div><div className="sg-pending-actions"><PillButton primary><Check size={14} strokeWidth={1.5} />Confirm action</PillButton><PillButton>Cancel</PillButton></div></section> }

function ChatShowcase() { const [open, setOpen] = useState(false); const [closed, setClosed] = useState(false); return <section className="sg-section sg-ai-section"><div className="sg-section-heading"><div><span className="sg-eyebrow">AI EXPERIENCE</span><h2>A calm layer for complex work.</h2></div><span className="sg-mono sg-muted">MOCK ONLY</span></div><div className="sg-ai-showcase">{open && !closed && <ChatPanel onCollapse={() => setOpen(false)} onClose={() => { setOpen(false); setClosed(true) }} />}<PendingAction /></div>{!open && !closed && <button className="sg-floating-chat" onClick={() => setOpen(true)} aria-label="Open AI chat"><Sparkles size={24} strokeWidth={1.5} /><i /></button>}{closed && <button className="sg-reset-chat" onClick={() => { setClosed(false); setOpen(true) }}>Reopen conversation</button>}</section> }

export default function StyleGuideShell() { const [theme, setTheme] = useState<Theme>('dark'); const toggleTheme = () => setTheme((value) => value === 'dark' ? 'light' : 'dark'); return <div data-theme={theme} className="sg-page"><div className="sg-theme-switch"><span>Theme preview</span><button className={`sg-toggle ${theme === 'light' ? 'is-on' : ''}`} onClick={toggleTheme} aria-label="Toggle dark and light theme"><i /></button><span className="sg-mono">{theme.toUpperCase()}</span></div><DashboardShowcase theme={theme} onThemeChange={toggleTheme} /><ChatShowcase /></div> }
