import { Info, AlertTriangle } from 'lucide-react'

type CalloutVariant = 'info' | 'warning'

interface CalloutProps {
  variant: CalloutVariant
  children: React.ReactNode
}

export function Callout({ variant, children }: CalloutProps) {
  const styles = {
    info: {
      container: 'bg-blue-50 border-blue-200 text-blue-900',
      icon: 'text-blue-600',
      Icon: Info,
    },
    warning: {
      container: 'bg-amber-50 border-amber-200 text-amber-900',
      icon: 'text-amber-600',
      Icon: AlertTriangle,
    },
  }

  const { container, icon, Icon } = styles[variant]

  return (
    <div className={`flex gap-3 p-4 border rounded-lg ${container}`}>
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${icon}`} />
      <div className="flex-1 text-sm leading-relaxed">{children}</div>
    </div>
  )
}
