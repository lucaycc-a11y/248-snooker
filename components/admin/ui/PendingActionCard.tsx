'use client'

import { Check } from 'lucide-react'
import { PillButton } from './Button'

export default function PendingActionCard() {
  return (
    <section className="sg-pending">
      <div className="sg-card-heading">
        <span className="sg-eyebrow">PENDING ACTION</span>
        <span className="sg-pending-dot" />
      </div>
      <div className="sg-pending-grid">
        <span>Field</span>
        <span>Old value</span>
        <span>New value</span>
        <b>Status</b>
        <span>Draft</span>
        <strong>Confirmed</strong>
      </div>
      <div className="sg-pending-actions">
        <PillButton primary>
          <Check size={14} strokeWidth={1.5} />
          Confirm action
        </PillButton>
        <PillButton>Cancel</PillButton>
      </div>
    </section>
  )
}
