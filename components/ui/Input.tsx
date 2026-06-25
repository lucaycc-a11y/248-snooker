'use client'

import { useState, forwardRef } from 'react'
import { tokens } from '@/app/styles/tokens'

type InputProps = {
  label?: string
  error?: string
  leftSlot?: React.ReactNode
  rightSlot?: React.ReactNode
  inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'url' | 'search' | 'decimal'
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'inputMode'>

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leftSlot, rightSlot, inputMode, style, ...props }, ref) => {
    const [focused, setFocused] = useState(false)

    const borderColor = error
      ? tokens.colors.danger
      : focused
        ? tokens.colors.brand
        : tokens.colors.border

    return (
      <div style={{ width: '100%' }}>
        {label && (
          <label
            style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: 500,
              color: tokens.colors.textMuted,
            }}
          >
            {label}
          </label>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: '52px',
            backgroundColor: 'rgba(255,255,255,0.06)',
            border: `1px solid ${borderColor}`,
            borderRadius: tokens.radius.input,
            transition: `border-color ${tokens.duration.base} ${tokens.easing.standard}`,
            overflow: 'hidden',
            ...style,
          }}
        >
          {leftSlot && (
            <div style={{ paddingLeft: '14px', display: 'flex', alignItems: 'center' }}>
              {leftSlot}
            </div>
          )}
          <input
            ref={ref}
            inputMode={inputMode}
            onFocus={(e) => {
              setFocused(true)
              props.onFocus?.(e)
            }}
            onBlur={(e) => {
              setFocused(false)
              props.onBlur?.(e)
            }}
            style={{
              flex: 1,
              height: '100%',
              padding: `0 ${leftSlot ? '10px' : '16px'}`,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: tokens.colors.text,
              fontSize: '16px',
              fontFamily: tokens.font.sans,
            }}
            {...props}
          />
          {rightSlot && (
            <div style={{ paddingRight: '14px', display: 'flex', alignItems: 'center' }}>
              {rightSlot}
            </div>
          )}
        </div>
        {error && (
          <p
            style={{
              marginTop: '6px',
              fontSize: '13px',
              color: tokens.colors.danger,
            }}
          >
            {error}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
