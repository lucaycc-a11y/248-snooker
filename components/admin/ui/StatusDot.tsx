type Status = 'success' | 'warning' | 'danger' | 'pending'

type StatusDotProps = {
  status: Status
  label?: string
}

export default function StatusDot({ status, label }: StatusDotProps) {
  return (
    <span
      className={`admin-ui-status-dot admin-ui-status-dot--${status}`}
      aria-label={label ?? status}
      role="img"
    />
  )
}

export type { Status }
