'use client'

import { Sparkles, ChevronDown } from 'lucide-react'

type ModelSelectorProps = {
  model: string
  open: boolean
  onToggle: () => void
  onSelect: (model: string) => void
}

export default function ModelSelector({ model, open, onToggle, onSelect }: ModelSelectorProps) {
  return (
    <div className="sg-model-wrap">
      <button className="sg-model-button" onClick={onToggle}>
        <Sparkles size={14} strokeWidth={1.5} />
        {model}
        <ChevronDown size={12} strokeWidth={1.5} />
      </button>
      {open && (
        <div className="sg-model-menu">
          <button onClick={() => onSelect('Claude Opus 5')}>Claude Opus 5</button>
          <button onClick={() => onSelect('Claude Sonnet 5')}>Claude Sonnet 5</button>
        </div>
      )}
    </div>
  )
}
