"use client"

import { useState, useEffect, useRef } from "react"

interface DateInputProps {
  value: { day: string; month: string; year: string }
  onChange: (value: { day: string; month: string; year: string }) => void
  disabled?: boolean
  label: string
  hint?: string
}

/**
 * Date input with three numeric fields (DD/MM/YYYY).
 * Auto-advances to next field on valid input.
 * Validates: real dates (including leap years), not future, not before 1900.
 */
export function DateInput({
  value,
  onChange,
  disabled = false,
  label,
  hint,
}: DateInputProps) {
  const dayRef = useRef<HTMLInputElement>(null)
  const monthRef = useRef<HTMLInputElement>(null)
  const yearRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const handleDayChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 2)
    onChange({ ...value, day: digits })
    if (digits.length === 2) {
      monthRef.current?.focus()
    }
  }

  const handleMonthChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 2)
    onChange({ ...value, month: digits })
    if (digits.length === 2) {
      yearRef.current?.focus()
    }
  }

  const handleYearChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4)
    onChange({ ...value, year: digits })
  }

  const handleDayKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && value.day === '') {
      // Stay on day field
    }
  }

  const handleMonthKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && value.month === '') {
      dayRef.current?.focus()
    }
  }

  const handleYearKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && value.year === '') {
      monthRef.current?.focus()
    }
  }

  // Validate complete date
  useEffect(() => {
    if (!value.day || !value.month || !value.year) {
      setError(null)
      return
    }

    const day = parseInt(value.day, 10)
    const month = parseInt(value.month, 10)
    const year = parseInt(value.year, 10)

    // Basic range checks
    if (year < 1900) {
      setError('年份不得早於 1900 年')
      return
    }

    if (year > new Date().getFullYear()) {
      setError('出生日期不得為未來日期')
      return
    }

    if (month < 1 || month > 12) {
      setError('月份必須在 1 至 12 之間')
      return
    }

    // Check if date is valid (including leap years)
    const dateObj = new Date(year, month - 1, day)
    if (
      dateObj.getDate() !== day ||
      dateObj.getMonth() !== month - 1 ||
      dateObj.getFullYear() !== year
    ) {
      setError('請輸入有效的日期')
      return
    }

    // Check not future
    if (dateObj > new Date()) {
      setError('出生日期不得為未來日期')
      return
    }

    setError(null)
  }, [value])

  const inputStyle = {
    height: 56,
    textAlign: 'center' as const,
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${error ? '#f87171' : 'rgba(255,255,255,0.14)'}`,
    borderRadius: 12,
    color: '#fff',
    fontSize: 18,
    fontWeight: 600,
    outline: 'none',
    transition: 'border-color 150ms ease',
  }

  return (
    <div>
      <label className="sr-only">{label}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          ref={dayRef}
          type="text"
          value={value.day}
          onChange={(e) => handleDayChange(e.target.value)}
          onKeyDown={handleDayKeyDown}
          disabled={disabled}
          placeholder="DD"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          aria-label="日"
          style={{ ...inputStyle, width: 80 }}
        />
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 20 }}>/</span>
        <input
          ref={monthRef}
          type="text"
          value={value.month}
          onChange={(e) => handleMonthChange(e.target.value)}
          onKeyDown={handleMonthKeyDown}
          disabled={disabled}
          placeholder="MM"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          aria-label="月"
          style={{ ...inputStyle, width: 80 }}
        />
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 20 }}>/</span>
        <input
          ref={yearRef}
          type="text"
          value={value.year}
          onChange={(e) => handleYearChange(e.target.value)}
          onKeyDown={handleYearKeyDown}
          disabled={disabled}
          placeholder="YYYY"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          aria-label="年"
          style={{ ...inputStyle, flex: 1 }}
        />
      </div>

      {hint && !error && (
        <p style={{ marginTop: 6, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
          {hint}
        </p>
      )}

      {error && (
        <p style={{ marginTop: 6, fontSize: 13, color: '#f87171' }} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * Validate if date string (YYYY-MM-DD) is valid
 */
export function validateDateOfBirth(dateString: string): { valid: boolean; error?: string } {
  const [year, month, day] = dateString.split('-').map(s => parseInt(s, 10))

  if (!year || !month || !day) {
    return { valid: false, error: '請輸入完整的出生日期' }
  }

  if (year < 1900) {
    return { valid: false, error: '年份不得早於 1900 年' }
  }

  if (year > new Date().getFullYear()) {
    return { valid: false, error: '出生日期不得為未來日期' }
  }

  if (month < 1 || month > 12) {
    return { valid: false, error: '月份必須在 1 至 12 之間' }
  }

  const dateObj = new Date(year, month - 1, day)
  if (
    dateObj.getDate() !== day ||
    dateObj.getMonth() !== month - 1 ||
    dateObj.getFullYear() !== year
  ) {
    return { valid: false, error: '請輸入有效的日期' }
  }

  if (dateObj > new Date()) {
    return { valid: false, error: '出生日期不得為未來日期' }
  }

  return { valid: true }
}
