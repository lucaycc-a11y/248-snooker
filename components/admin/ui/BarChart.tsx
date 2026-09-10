type BarHeight = 'short' | 'medium' | 'tall' | 'full'

type BarChartItem = {
  label: string
  labelCmsKey: string
  value: string
  valueCmsKey: string
  height: BarHeight
}

type BarChartProps = {
  items: readonly BarChartItem[]
  ariaLabel: string
  cmsKey: string
}

export default function BarChart({ items, ariaLabel, cmsKey }: BarChartProps) {
  return (
    <div className="admin-ui-chart" aria-label={ariaLabel} data-cms-key={cmsKey}>
      <div className="admin-ui-chart__bar-list">
        {items.map((item, index) => (
          <div className="admin-ui-chart__bar-column" key={item.labelCmsKey}>
            <span data-cms-key={item.valueCmsKey}>{item.value}</span>
            <span
              className={`admin-ui-chart__bar admin-ui-chart__bar--${item.height} ${index > 0 ? 'admin-ui-chart__bar--muted' : ''}`}
              aria-hidden="true"
            />
            <span data-cms-key={item.labelCmsKey}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
