"use client"

import { useRef, useState, type KeyboardEvent, type ClipboardEvent } from "react"

// Accessible OTP entry: N digit boxes with auto-advance, backspace-to-previous,
// and paste-the-whole-code support. Calls onComplete when all digits are filled.
const GREEN = "#22c55e"

export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
}: {
  length?: number
  value: string
  onChange: (next: string) => void
  onComplete?: (code: string) => void
  disabled?: boolean
  invalid?: boolean
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const [focused, setFocused] = useState<number | null>(null)

  const setDigit = (i: number, d: string) => {
    const next = value.split("")
    next[i] = d
    const joined = next.join("").slice(0, length)
    onChange(joined)
    if (d && i < length - 1) refs.current[i + 1]?.focus()
    // join("") collapses empty slots, so a full code is exactly `length` chars;
    // any gap makes it shorter. (Note: String.includes("") is always true — the
    // old "!joined.includes('')" guard meant onComplete could never fire on type.)
    if (joined.length === length) {
      onComplete?.(joined)
    }
  }

  const handleKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault()
      const next = value.split("")
      if (next[i]) {
        next[i] = ""
        onChange(next.join(""))
      } else if (i > 0) {
        next[i - 1] = ""
        onChange(next.join(""))
        refs.current[i - 1]?.focus()
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      refs.current[i - 1]?.focus()
    } else if (e.key === "ArrowRight" && i < length - 1) {
      refs.current[i + 1]?.focus()
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length)
    if (!digits) return
    onChange(digits)
    const focusIdx = Math.min(digits.length, length - 1)
    refs.current[focusIdx]?.focus()
    if (digits.length === length) onComplete?.(digits)
  }

  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          value={value[i] ?? ""}
          onChange={(e) => setDigit(i, e.target.value.replace(/\D/g, "").slice(-1))}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          onFocus={() => setFocused(i)}
          onBlur={() => setFocused(null)}
          style={{
            width: 44,
            height: 56,
            textAlign: "center",
            fontSize: 24,
            fontWeight: 600,
            color: "#fff",
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${
              invalid
                ? "#f87171"
                : focused === i
                  ? GREEN
                  : "rgba(255,255,255,0.14)"
            }`,
            borderRadius: 12,
            outline: "none",
            transition: "border-color 150ms ease",
          }}
        />
      ))}
    </div>
  )
}
