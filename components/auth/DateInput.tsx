"use client"

import { useState, useEffect, useRef } from "react"

interface DateInputProps {
  value: { day: string; month: string; year: string }
  onChange: (value: { day: string; month: string; year: string }) => void
  disabled?: boolean
  label: string
  hint?: string
  /** When true the entire field may be left blank without blocking submit. */
  optional?: boolean
  /** When false (default) only DD/MM are collected. Set true to also collect YYYY. */
  askYear?: boolean
  /** Labels for the optional badge and error messages, supplied by the parent. */
  optionalBadgeLabel?: string
  errorIncomplete?: string
  errorInvalid?: string
  errorYear?: string
}

/**
 * Date input with two or three numeric fields (DD/MM or DD/MM/YYYY).
 * Auto-advances to next field on valid input.
 * When optional=true, an empty field is valid and submission is not blocked.
 * ASK_YEAR (passed as askYear) controls whether the year column appears.
 */
export function DateInput({
  value,
  onChange,
  disabled = false,
  label,
  hint,
  optional = false,
  askYear = false,
  optionalBadgeLabel = "選填",
  errorIncomplete = "請填寫完整日期，或將欄位全部留空。",
  errorInvalid = "日期不正確。",
  errorYear = "年份不正確。",
}: DateInputProps) {
  const dayRef = useRef<HTMLInputElement>(null)
  const monthRef = useRef<HTMLInputElement>(null)
  const yearRef = useRef<HTMLInputElement>(null)
  // Track which fields have been touched so errors only show after blur
  const [touched, setTouched] = useState({ day: false, month: false, year: false })
  const [showError, setShowError] = useState(false)

  const isEmpty = !value.day && !value.month && (!askYear || !value.year)
  const filledParts = [value.day, value.month, ...(askYear ? [value.year] : [])].filter(Boolean).length
  const totalParts = askYear ? 3 : 2
  const isPartial = filledParts > 0 && filledParts < totalParts

  const handleDayChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 2)
    onChange({ ...value, day: digits })
    if (digits.length === 2) monthRef.current?.focus()
  }

  const handleMonthChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 2)
    onChange({ ...value, month: digits })
    if (digits.length === 2 && askYear) yearRef.current?.focus()
  }

  const handleYearChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 4)
    onChange({ ...value, year: digits })
  }

  const handleMonthKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && value.month === "") dayRef.current?.focus()
  }

  const handleYearKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && value.year === "") monthRef.current?.focus()
  }

  const handleBlur = (field: "day" | "month" | "year") => {
    setTouched((prev) => ({ ...prev, [field]: true }))
    setShowError(true)
  }

  // Compute inline error
  const inlineError = (): string | null => {
    if (!showError) return null
    if (isEmpty) return null
    if (isPartial) return errorIncomplete
    // All parts filled — validate
    const d = parseInt(value.day, 10)
    const m = parseInt(value.month, 10)
    const y = askYear ? parseInt(value.year, 10) : 2000 // use leap year as stand-in when year not collected
    if (askYear) {
      const currentYear = new Date().getFullYear()
      if (value.year.length !== 4 || y < 1900 || y > currentYear) return errorYear
    }
    const dateObj = new Date(y, m - 1, d)
    if (dateObj.getDate() !== d || dateObj.getMonth() !== m - 1 || dateObj.getFullYear() !== y) {
      return errorInvalid
    }
    return null
  }

  const error = inlineError()
  const hasError = error !== null

  // Clear show-error state when all fields are emptied
  useEffect(() => {
    if (isEmpty) {
      setShowError(false)
      setTouched({ day: false, month: false, year: false })
    }
  }, [isEmpty])

  const inputStyle = (invalid: boolean): React.CSSProperties => ({
    height: 52,
    minWidth: 0,
    textAlign: "center",
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${invalid ? "#f87171" : "rgba(255,255,255,0.14)"}`,
    borderRadius: 12,
    color: "#fff",
    fontSize: 16,
    fontWeight: 600,
    outline: "none",
    transition: "border-color 150ms ease",
    padding: "0 8px",
    width: "100%",
  })

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {/* Label row with optional badge */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <label
          style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)", padding: 0 }}
          aria-label={label}
        >
          {label}
        </label>
        {optional && (
          <span
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.45)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 999,
              padding: "2px 10px",
              whiteSpace: "nowrap",
            }}
          >
            {optionalBadgeLabel}
          </span>
        )}
      </div>

      {/* Input row — CSS grid keeps fields inside the card at any viewport width */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: askYear ? "1fr auto 1fr auto 1.5fr" : "1fr auto 1fr",
          alignItems: "center",
          gap: 8,
        }}
      >
        <input
          ref={dayRef}
          type="text"
          value={value.day}
          onChange={(e) => handleDayChange(e.target.value)}
          onBlur={() => handleBlur("day")}
          disabled={disabled}
          placeholder="DD"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          autoComplete="bday-day"
          aria-label="日"
          aria-invalid={hasError}
          style={inputStyle(hasError && (touched.day || value.day !== ""))}
        />
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 20, lineHeight: 1 }} aria-hidden="true">/</span>
        <input
          ref={monthRef}
          type="text"
          value={value.month}
          onChange={(e) => handleMonthChange(e.target.value)}
          onKeyDown={handleMonthKeyDown}
          onBlur={() => handleBlur("month")}
          disabled={disabled}
          placeholder="MM"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          autoComplete="bday-month"
          aria-label="月"
          aria-invalid={hasError}
          style={inputStyle(hasError && (touched.month || value.month !== ""))}
        />
        {askYear && (
          <>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 20, lineHeight: 1 }} aria-hidden="true">/</span>
            <input
              ref={yearRef}
              type="text"
              value={value.year}
              onChange={(e) => handleYearChange(e.target.value)}
              onKeyDown={handleYearKeyDown}
              onBlur={() => handleBlur("year")}
              disabled={disabled}
              placeholder="YYYY"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              autoComplete="bday-year"
              aria-label="年"
              aria-invalid={hasError}
              style={inputStyle(hasError && (touched.year || value.year !== ""))}
            />
          </>
        )}
      </div>

      {hint && !hasError && (
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "rgba(255,255,255,0.45)" }}>
          {hint}
        </p>
      )}

      {hasError && (
        <p style={{ margin: 0, fontSize: 12.5, color: "#f87171" }} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
