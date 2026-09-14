'use client'

import { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type PasswordInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  showLabel?: string
  hideLabel?: string
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ showLabel = 'Show password', hideLabel = 'Hide password', style, ...props }, ref) => {
    const [visible, setVisible] = useState(false)

    return (
      <div style={{ position: 'relative', width: '100%' }}>
        <input
          ref={ref}
          {...props}
          type={visible ? 'text' : 'password'}
          style={{ boxSizing: 'border-box', paddingRight: 56, width: '100%', ...style }}
        />
        <button
          type="button"
          aria-label={visible ? hideLabel : showLabel}
          onClick={() => setVisible((current) => !current)}
          disabled={props.disabled}
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.65)',
            cursor: props.disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
    )
  },
)

PasswordInput.displayName = 'PasswordInput'
