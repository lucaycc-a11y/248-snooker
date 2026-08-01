import { tokens } from '@/app/styles/tokens'

type ProgressStepsProps = {
  steps: string[]
  current: number
  // When provided, COMPLETED steps (index < current) become clickable for
  // backward navigation. Current and future steps are never clickable — no
  // forward-jumping past work that isn't done.
  onStepClick?: (index: number) => void
  // Goal Gradient Effect: 0-1 fraction filling the connector line INTO the
  // current step, so making a selection on the current screen (before its
  // own explicit "Continue" click advances `current`) already visually
  // reads as progress, instead of only jumping in whole steps.
  currentProgress?: number
}

export function ProgressSteps({ steps, current, onStepClick, currentProgress = 0 }: ProgressStepsProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
      {steps.map((label, i) => {
        const isComplete = i < current
        const isCurrent = i === current
        const isLast = i === steps.length - 1
        const clickable = isComplete && !!onStepClick

        const column = (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: isComplete
                  ? tokens.colors.text
                  : isCurrent
                    ? tokens.colors.brand
                    : 'transparent',
                border: !isComplete && !isCurrent
                  ? `2px solid ${tokens.colors.textFaint}`
                  : 'none',
                transition: `all ${tokens.duration.base} ${tokens.easing.standard}`,
              }}
            />
            <span
              style={{
                marginTop: '8px',
                fontSize: '12px',
                fontWeight: isCurrent ? 600 : 400,
                color: isCurrent ? tokens.colors.text : tokens.colors.textMuted,
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </span>
          </div>
        )

        return (
          <div
            key={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              flex: isLast ? '0 0 auto' : '1 1 0',
            }}
          >
            {clickable ? (
              <button
                type="button"
                onClick={() => onStepClick(i)}
                aria-label={label}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  margin: 0,
                  cursor: 'pointer',
                  font: 'inherit',
                  color: 'inherit',
                }}
              >
                {column}
              </button>
            ) : (
              column
            )}
            {!isLast && (
              <div
                style={{
                  flex: 1,
                  height: '2px',
                  position: 'relative',
                  backgroundColor: isComplete ? tokens.colors.text : tokens.colors.textFaint,
                  marginLeft: '8px',
                  marginRight: '8px',
                  marginTop: '5px',
                  alignSelf: 'flex-start',
                  transition: `background-color ${tokens.duration.base} ${tokens.easing.standard}`,
                }}
              >
                {isCurrent && currentProgress > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: `${Math.min(currentProgress, 1) * 100}%`,
                      backgroundColor: tokens.colors.brand,
                      transition: `width ${tokens.duration.base} ${tokens.easing.standard}`,
                    }}
                  />
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
