import { statusOf } from '@/lib/admin/today'

type Tone = 'good' | 'warn' | 'bad' | 'info' | 'mute' | 'test'

/**
 * AdminStatusBadge — Chinese label + tone for a booking status, or a custom
 * label with an explicit tone. Never shows a raw enum value for known statuses.
 */
export default function AdminStatusBadge({
  status,
  label,
  tone,
}: {
  status?: string
  label?: string
  tone?: Tone
}) {
  const [mapped, mappedTone] = status ? statusOf(status) : [label ?? '—', 'mute']
  const text = label ?? mapped
  const className = `admin-badge ${tone ?? mappedTone}`
  return <span className={className}>{text}</span>
}
