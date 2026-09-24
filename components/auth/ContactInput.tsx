"use client"

import { useState, useEffect, useRef } from "react"
import { normalizeHkPhone } from "@/lib/auth/profile"

export type ContactType = "phone" | "email" | "unknown"

export interface ContactInputValue {
  raw: string
  type: ContactType
  normalized: string | null
  valid: boolean
}

interface ContactInputProps {
  value: string
  onChange: (value: string) => void
  onTypeChange: (type: ContactType) => void
  disabled?: boolean
  autoFocus?: boolean
  placeholder: string
  label: string
}

/**
 * Smart contact input that auto-detects phone vs email.
 * - Phone: starts with digit or +, shows country code selector (🇭🇰 +852)
 * - Email: contains @, validates format
 * - Validates HK phone: 8 digits, starts with 2/3/5/6/7/8/9
 */
export function ContactInput({
  value,
  onChange,
  onTypeChange,
  disabled = false,
  autoFocus = false,
  placeholder,
  label,
}: ContactInputProps) {
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-detect contact type
  const contactType: ContactType =
    value.startsWith('+') || /^\d/.test(value) ? 'phone' :
    value.includes('@') ? 'email' :
    'unknown'

  // Validate email format
  const isValidEmail = contactType === 'email' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

  // Validate HK phone: 8 digits, starts with 2/3/5/6/7/8/9
  const normalized = contactType === 'phone' ? normalizeHkPhone(value) : null
  const isValidPhone = normalized !== null

  const isValid =
    contactType === 'email' ? isValidEmail :
    contactType === 'phone' ? isValidPhone :
    false

  useEffect(() => {
    onTypeChange(contactType)
  }, [contactType, onTypeChange])

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  return (
    <div>
      <label htmlFor="contact-input" className="sr-only">{label}</label>
      <div style={{ position: 'relative' }}>
        {/* Country code prefix for phone */}
        {contactType === 'phone' && (
          <div
            style={{
              position: 'absolute',
              left: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 16,
              color: '#fff',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            <span>🇭🇰</span>
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>+852</span>
          </div>
        )}

        <input
          ref={inputRef}
          id="contact-input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          inputMode={contactType === 'phone' ? 'tel' : 'email'}
          style={{
            width: '100%',
            height: 56,
            paddingLeft: contactType === 'phone' ? 110 : 16,
            paddingRight: 16,
            background: 'rgba(255,255,255,0.04)',
            border: `2px solid ${
              focused ? '#22c55e' :
              value && !isValid ? '#f87171' :
              'rgba(255,255,255,0.14)'
            }`,
            borderRadius: 12,
            color: '#fff',
            fontSize: 16,
            outline: 'none',
            transition: 'border-color 150ms ease',
          }}
        />
      </div>

      {/* Validation hint */}
      {value && !isValid && !focused && (
        <p
          style={{
            marginTop: 6,
            fontSize: 13,
            color: '#f87171',
          }}
        >
          {contactType === 'phone'
            ? '請輸入有效的香港手機號碼（8 位數字）'
            : '請輸入有效的電郵地址'
          }
        </p>
      )}
    </div>
  )
}
