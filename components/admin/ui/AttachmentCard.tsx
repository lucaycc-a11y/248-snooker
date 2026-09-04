'use client'

import { Calendar } from 'lucide-react'

type AttachmentCardProps = {
  long?: boolean
}

export default function AttachmentCard({ long = false }: AttachmentCardProps) {
  return (
    <div className="sg-attachment">
      <span className="sg-attachment-icon">
        <Calendar size={18} strokeWidth={1.5} />
      </span>
      <div>
        <small>Onboarding Meeting</small>
        <strong
          title={long ? 'Project Kickoff Meeting — Space8 Admin Dashboard' : undefined}
        >
          {long ? 'Project Kickoff Meeting — Space8…' : 'Design Review Notes'}
        </strong>
      </div>
      <time>Dec 16, 2025</time>
    </div>
  )
}
