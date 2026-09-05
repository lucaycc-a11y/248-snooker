'use client'

import { CircleUserRound, Filter, ArrowUpRight } from 'lucide-react'
import { IconButton } from './Button'

const transactions = [
  ['PlayStation', '•••• 0224', '31 Mar, 3:20 PM', '$19.99', 'var(--status-warning)'],
  ['Netflix', '•••• 0224', '29 Mar, 5:11 PM', '$30.00', 'var(--status-danger)'],
  ['Airbnb', '•••• 4432', '29 Mar, 1:20 PM', '$300.00', 'var(--green-bright)'],
  ['Tommy C.', '•••• 0224', '27 Mar, 2:31 AM', '+$27.00', 'var(--green-bright)'],
  ['Apple', '•••• 4432', '27 Mar, 11:04 PM', '$10.00', 'var(--green)'],
]

export default function TransactionsCard() {
  return (
    <section className="sg-card sg-transactions">
      <div className="sg-card-heading">
        <h3>Transactions</h3>
        <div className="sg-heading-actions">
          <IconButton label="Filter transactions">
            <Filter size={16} strokeWidth={1.5} />
          </IconButton>
          <IconButton label="Expand transactions">
            <ArrowUpRight size={16} strokeWidth={1.5} />
          </IconButton>
        </div>
      </div>
      <div className="sg-transaction-list">
        {transactions.map(([name, account, date, amount, color]) => (
          <div className="sg-transaction" key={name}>
            <span className="sg-merchant-icon" style={{ background: color }}>
              <CircleUserRound size={14} strokeWidth={1.5} />
            </span>
            <div>
              <strong>{name}</strong>
              <small className="sg-mono">{account}</small>
            </div>
            <time>{date}</time>
            <b className="sg-mono" style={{ color }}>{amount}</b>
          </div>
        ))}
      </div>
    </section>
  )
}
