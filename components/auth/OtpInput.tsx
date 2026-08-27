"use client"

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react"

// Accessible OTP entry: N digit boxes with auto-advance, backspace-to-previous,
// and paste/autofill support. Empty slots stay positional until the full code is
// complete, so editing one digit never shifts the digits that follow it.
const GREEN = "#22c55e"

export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
  className,
  digitLabel = (index) => `Digit ${index + 1}`,
  ariaDescribedBy,
  focusFirst = false,
}: {
  length?: number
  value: string[]
  onChange: (next: string[]) => void
  onComplete?: (code: string) => void
  disabled?: boolean
  invalid?: boolean
  className?: string
  digitLabel?: (index: number) => string
  ariaDescribedBy?: string
  focusFirst?: boolean
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const [focused, setFocused] = useState<number | null>(null)
  const slots = Array.from({ length }, (_, index) => value[index] ?? "")

  useEffect(() => {
    if (focusFirst) refs.current[0]?.focus()
  }, [focusFirst])

  const completeIfReady = (next: string[]) => {
    if (!slots.every((digit) => digit.length === 1) && next.every((digit) => digit.length === 1)) {
      onComplete?.(next.join(""))
    }
  }

  const setSlots = (next: string[], focusIndex?: number) => {
    onChange(next)
    if (focusIndex !== undefined) refs.current[focusIndex]?.focus()
    completeIfReady(next)
  }

  const setDigit = (index: number, digit: string) => {
    const next = [...slots]
    next[index] = digit
    setSlots(next, digit && index < length - 1 ? index + 1 : undefined)
  }

  const setCode = (startIndex: number, raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, length - startIndex)
    if (!digits) return

    const next = [...slots]
    for (let offset = 0; offset < digits.length; offset += 1) {
      next[startIndex + offset] = digits[offset]
    }

    const nextEmpty = next.findIndex((digit) => !digit)
    const focusIndex = nextEmpty >= 0 ? nextEmpty : length - 1
    setSlots(next, focusIndex)
  }

  const handleChange = (index: number, raw: string) => {
    // Mobile browsers may put the entire SMS code into the first field despite
    // maxLength=1. Distribute it before the single-character path truncates it.
    if (raw.length > 1) {
      setCode(index, raw)
      return
    }
    setDigit(index, raw.replace(/\D/g, "").slice(-1))
  }

  const handleKey = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      event.preventDefault()
      const next = [...slots]
      if (next[index]) {
        next[index] = ""
        onChange(next)
      } else if (index > 0) {
        next[index - 1] = ""
        setSlots(next, index - 1)
      }
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault()
      refs.current[index - 1]?.focus()
    } else if (event.key === "ArrowRight" && index < length - 1) {
      event.preventDefault()
      refs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    setCode(0, event.clipboardData.getData("text"))
  }

  return (
    <div className={`otp-input-row${className ? ` ${className}` : ""}`}>
      {slots.map((digit, index) => (
        <input
          key={index}
          className="otp-digit-input"
          ref={(element) => {
            refs.current[index] = element
          }}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={length}
          disabled={disabled}
          aria-label={digitLabel(index)}
          aria-describedby={ariaDescribedBy}
          aria-invalid={invalid || undefined}
          value={digit}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKey(index, event)}
          onPaste={handlePaste}
          onFocus={() => setFocused(index)}
          onBlur={() => setFocused(null)}
          style={{
            textAlign: "center",
            fontSize: 24,
            fontWeight: 600,
            color: "#fff",
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${
              invalid
                ? "#f87171"
                : focused === index
                  ? GREEN
                  : "rgba(255,255,255,0.28)"
            }`,
            borderRadius: 12,
            transition: "border-color 150ms ease",
          }}
        />
      ))}
    </div>
  )
}
