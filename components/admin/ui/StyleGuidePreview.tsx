'use client'

import { LayoutDashboard, Settings } from 'lucide-react'
import { useState } from 'react'
import BarChart from './BarChart'
import { Button, IconButton } from './Button'
import LineChart from './LineChart'
import NavItem from './NavItem'
import RingChart from './RingChart'
import StatusDot from './StatusDot'
import WidgetCard from './WidgetCard'
import WidgetGrid from './WidgetGrid'

type PreviewWidget = {
  id: string
  size: '1x1' | '2x1' | '1x2' | '2x2'
  title: string
  titleCmsKey: string
  value: string
  chart: 'line' | 'bar' | 'ring'
}

const INITIAL_WIDGETS: PreviewWidget[] = [
  { id: 'balance', size: '2x1', title: 'Balance overview', titleCmsKey: 'admin_style_guide_balance_overview', value: '$17,241', chart: 'line' },
  { id: 'earnings', size: '1x1', title: 'Earnings', titleCmsKey: 'admin_style_guide_earnings', value: '$6,400', chart: 'ring' },
  { id: 'spending', size: '1x1', title: 'Spending', titleCmsKey: 'admin_style_guide_spending', value: '$2,000', chart: 'bar' },
]

const BAR_ITEMS = [
  { label: 'Clothing', labelCmsKey: 'admin_style_guide_bar_clothing', value: '34%', valueCmsKey: 'admin_style_guide_bar_clothing_value', height: 'full' },
  { label: 'Groceries', labelCmsKey: 'admin_style_guide_bar_groceries', value: '16%', valueCmsKey: 'admin_style_guide_bar_groceries_value', height: 'tall' },
  { label: 'Pets', labelCmsKey: 'admin_style_guide_bar_pets', value: '8%', valueCmsKey: 'admin_style_guide_bar_pets_value', height: 'medium' },
  { label: 'Bills', labelCmsKey: 'admin_style_guide_bar_bills', value: '6%', valueCmsKey: 'admin_style_guide_bar_bills_value', height: 'short' },
] as const

export default function StyleGuidePreview() {
  const [widgets, setWidgets] = useState(INITIAL_WIDGETS)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const move = (id: string, direction: 'previous' | 'next') => {
    setWidgets((current) => {
      const index = current.findIndex((widget) => widget.id === id)
      const target = direction === 'previous' ? index - 1 : index + 1
      if (index < 0 || target < 0 || target >= current.length) return current
      const next = [...current]
      const [widget] = next.splice(index, 1)
      next.splice(target, 0, widget)
      return next
    })
  }

  const moveDraggedTo = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return
    setWidgets((current) => {
      const currentIndex = current.findIndex((widget) => widget.id === draggedId)
      const targetIndex = current.findIndex((widget) => widget.id === targetId)
      if (currentIndex < 0 || targetIndex < 0) return current
      const next = [...current]
      const [widget] = next.splice(currentIndex, 1)
      next.splice(targetIndex, 0, widget)
      return next
    })
    setDraggedId(null)
  }

  return (
    <main className="admin-ui-style-guide">
      <header className="admin-ui-style-guide__header">
        <h1 data-cms-key="admin_style_guide_title">Admin component reference</h1>
        <p data-cms-key="admin_style_guide_description">Token-driven states for the admin interface.</p>
      </header>

      <section className="admin-ui-style-guide__section" aria-labelledby="button-states">
        <h2 id="button-states" data-cms-key="admin_style_guide_buttons">Button states</h2>
        <div className="admin-ui-style-guide__buttons">
          <Button variant="primary" data-cms-key="admin_style_guide_primary">Primary action</Button>
          <Button data-cms-key="admin_style_guide_secondary">Secondary action</Button>
          <Button variant="danger" data-cms-key="admin_style_guide_danger">Danger action</Button>
          <IconButton label="Open settings" data-cms-key="admin_style_guide_open_settings">
            <Settings size={20} strokeWidth={1.5} aria-hidden="true" />
          </IconButton>
        </div>
      </section>

      <section className="admin-ui-style-guide__section" aria-labelledby="navigation-states">
        <h2 id="navigation-states" data-cms-key="admin_style_guide_navigation">Navigation states</h2>
        <div className="admin-ui-style-guide__layout">
          <NavItem href="/admin/style-guide" label="Dashboard" cmsKey="admin_style_guide_nav_active" icon={LayoutDashboard} active />
          <NavItem href="/admin/style-guide" label="Settings" cmsKey="admin_style_guide_nav_default" icon={Settings} />
        </div>
      </section>

      <section className="admin-ui-style-guide__section" aria-labelledby="status-states">
        <h2 id="status-states" data-cms-key="admin_style_guide_statuses">Status states</h2>
        <div className="admin-ui-style-guide__statuses">
          {(['success', 'warning', 'danger', 'pending'] as const).map((status) => (
            <span className="admin-ui-status-reference" key={status}>
              <StatusDot status={status} />
              <span data-cms-key={`admin_style_guide_status_${status}`}>{status}</span>
            </span>
          ))}
        </div>
      </section>

      <section className="admin-ui-style-guide__section" aria-labelledby="widget-states">
        <h2 id="widget-states" data-cms-key="admin_style_guide_widgets">Widget grid</h2>
        <p data-cms-key="admin_style_guide_widget_instruction">Use arrow keys or drag a widget to reorder it.</p>
        <WidgetGrid
          widgets={widgets}
          draggedId={draggedId}
          onDragStart={setDraggedId}
          onDrop={moveDraggedTo}
          onKeyboardMove={move}
          renderWidget={(widget) => (
            <WidgetCard title={widget.title} titleCmsKey={widget.titleCmsKey} value={widget.value} className="admin-ui-widget-card--preview">
              {widget.chart === 'line' && <LineChart />}
              {widget.chart === 'bar' && (
                <BarChart
                  items={BAR_ITEMS}
                  ariaLabel="Spending category mock chart"
                  cmsKey="admin_style_guide_spending_chart"
                />
              )}
              {widget.chart === 'ring' && (
                <RingChart
                  percentage={58}
                  ariaLabel="Current progress: 58%"
                  label="Percentage"
                  labelCmsKey="admin_style_guide_percentage"
                  currentLabel="Current"
                  currentCmsKey="admin_style_guide_current"
                  goalLabel="Month goal"
                  goalCmsKey="admin_style_guide_month_goal"
                />
              )}
            </WidgetCard>
          )}
        />
      </section>
    </main>
  )
}
