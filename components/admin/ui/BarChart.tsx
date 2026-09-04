'use client'

import { UserRound, Grid2X2, Zap } from 'lucide-react'
import { IconButton } from './Button'

export default function BarChart() {
  return (
    <div className="sg-bars">
      {[
        ['34%', 'Clothing'],
        ['16%', 'Groceries'],
        ['8%', 'Pets'],
        ['6%', 'Bills'],
      ].map(([amount, label], index) => (
        <div className="sg-bar-column" key={label}>
          <span>{amount}</span>
          <div className={`sg-bar sg-bar-${index}`} />
          <small>{label}</small>
        </div>
      ))}
      <div className="sg-more-icons">
        <IconButton label="Clothing">
          <UserRound size={16} strokeWidth={1.5} />
        </IconButton>
        <IconButton label="Groceries">
          <Grid2X2 size={16} strokeWidth={1.5} />
        </IconButton>
        <IconButton label="Pets">
          <Zap size={16} strokeWidth={1.5} />
        </IconButton>
        <span>+8 more</span>
      </div>
    </div>
  )
}
