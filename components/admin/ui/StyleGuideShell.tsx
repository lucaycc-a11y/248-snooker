'use client'

import {
  ArrowUpRight,
  Calendar,
  Check,
  Clipboard,
  Code2,
  FileText,
  Grid2X2,
  LayoutGrid,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  SunMoon,
  TrendingUp,
} from 'lucide-react'
import { useState } from 'react'
import Logo from './Logo'
import { IconButton, PillButton } from './Button'
import GlassCard from './GlassCard'
import WidgetBody from './WidgetBody'
import ChatShowcase from './FloatingChat'

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
  return (
    <div className="sg-dashboard-shell">
      <aside className="sg-sidebar">
        <Logo href="/admin/style-guide" />
        <div className="sg-welcome">
          <div className="sg-welcome-top">
            <span className="sg-avatar">G</span>
            <div>
              <IconButton label="Toggle theme" onClick={onThemeChange}>
                <SunMoon size={16} strokeWidth={1.5} />
              </IconButton>
              <IconButton label="Settings">
                <Settings size={16} strokeWidth={1.5} />
              </IconButton>
            </div>
          </div>
          <small>MONDAY, MARCH 24</small>
          <p>Welcome back,<br /><b>George!</b></p>
        </div>
        <nav>
          {navItems.map(({ label, icon: NavIcon }, index) => (
            <button className={index === 0 ? 'is-active' : ''} key={label}>
              <NavIcon size={16} strokeWidth={1.5} />
              {label}
            </button>
          ))}
        </nav>
        <div className="sg-promo">
          <Sparkles size={18} strokeWidth={1.5} />
          <div>
            <b>Activate SPACE8 Pro</b>
            <small>Elevate your work with AI</small>
          </div>
        </div>
      </aside>
      <main className="sg-main">
        <header className="sg-topbar">
          <PillButton><Calendar size={14} strokeWidth={1.5} />This Month</PillButton>
          <div className="sg-top-search">
            <Search size={16} strokeWidth={1.5} />
            <span>Search dashboard...</span>
          </div>
          <div className="sg-top-actions">
            <PillButton><Grid2X2 size={14} strokeWidth={1.5} />Manage Widgets</PillButton>
            <PillButton primary><Plus size={14} strokeWidth={1.5} />Add new Widget</PillButton>
          </div>
        </header>
        <div className="sg-widget-grid">
          {ordered.map((widget) => (
            <div
              key={widget.id}
              draggable
              onDragStart={() => setDragged(widget.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => moveWidget(widget.id)}
              className={`sg-widget sg-size-${widget.size} ${dragged === widget.id ? 'is-dragging' : ''}`}
            >
              <WidgetBody widget={widget} />
            </div>
          ))}
        </div>
        <section className="sg-section">
          <div className="sg-section-heading">
            <div>
              <span className="sg-eyebrow">SYSTEM TOKENS</span>
              <h2>Visual language, made tangible.</h2>
            </div>
            <span className="sg-mono sg-muted">1x1 · 2x1 · 1x2 · 2x2</span>
          </div>
          <div className="sg-token-row">
            <div className="sg-card sg-token-card">
              <span className="sg-eyebrow">STATUS DOTS</span>
              <div className="sg-status-list">
                <span><i className="sg-dot is-green" />Success</span>
                <span><i className="sg-dot is-warning" />Warning</span>
                <span><i className="sg-dot is-danger" />Danger</span>
                <span><i className="sg-dot is-muted" />Pending</span>
              </div>
            </div>
            <GlassCard className="sg-demo-glass">
              <span className="sg-eyebrow">LIQUID GLASS</span>
              <h3>Blur creates hierarchy.</h3>
              <p>Translucent surfaces are reserved for AI and contextual layers.</p>
            </GlassCard>
            <div className="sg-card sg-token-card">
              <span className="sg-eyebrow">BUTTONS</span>
              <div className="sg-button-list">
                <PillButton primary><Check size={14} strokeWidth={1.5} />Primary</PillButton>
                <PillButton>Secondary</PillButton>
                <PillButton danger>Danger</PillButton>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default function StyleGuideShell() {
  const [theme, setTheme] = useState<Theme>('dark')
  const toggleTheme = () => setTheme((value) => value === 'dark' ? 'light' : 'dark')

  return (
    <div data-theme={theme} className="sg-page">
      <div className="sg-theme-switch">
        <span>Theme preview</span>
        <button
          className={`sg-toggle ${theme === 'light' ? 'is-on' : ''}`}
          onClick={toggleTheme}
          aria-label="Toggle dark and light theme"
        >
          <i />
        </button>
        <span className="sg-mono">{theme.toUpperCase()}</span>
      </div>
      <DashboardShowcase theme={theme} onThemeChange={toggleTheme} />
      <ChatShowcase />
    </div>
  )
}
