'use client'

import { RotateCcw, X } from 'lucide-react'

type SuggestionPanelProps = {
  selected: string
  onSelect: (value: string) => void
}

export default function SuggestionPanel({ selected, onSelect }: SuggestionPanelProps) {
  return (
    <div className="sg-suggestion-panel">
      <div className="sg-suggestion-hints">
        <span>↑↓ to navigate <i>·</i> ↵ to select</span>
        <span>esc to close</span>
      </div>
      <div className="sg-suggestions">
        <button onClick={() => onSelect('How should AI show uncertainty?')}>
          → <span>How should AI show uncertainty?</span>
        </button>
        <button
          className="is-selected"
          onClick={() => onSelect('Which UI elements build trust in AI responses?')}
        >
          → <span>Which UI elements build trust in AI responses?</span>
        </button>
        <button onClick={() => onSelect('What signals make AI responses feel reliable?')}>
          → <span>What signals make AI responses feel reliable?</span>
        </button>
      </div>
      <div className="sg-selected-prompt">
        <RotateCcw size={14} strokeWidth={1.5} />
        <span>{selected}</span>
        <X size={14} strokeWidth={1.5} />
      </div>
    </div>
  )
}
