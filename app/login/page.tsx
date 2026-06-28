'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { tokens } from '@/app/styles/tokens'
import { Logo, AppleLogo } from '@/components/brand'
import { Button, Input } from '@/components/ui'

type Step = 'methods' | 'otp'

export default function LoginPage() {
  const [step, setStep] = useState<Step>('methods')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''))
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  const phoneValid = /^\d{8}$/.test(phone)

  function handleOtpChange(index: number, value: string) {
    if (!/^\d?$/.test(value)) return
    const next = [...otp]
    next[index] = value
    setOtp(next)
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  function handleSendOtp() {
    if (!phoneValid) return
    setStep('otp')
  }

  useEffect(() => {
    if (step === 'otp') {
      otpRefs.current[0]?.focus()
    }
  }, [step])

  const otpComplete = otp.every((d) => d !== '')

  useEffect(() => {
    if (otpComplete) {
      // TODO: Supabase auth verify OTP, then redirect to /book
    }
  }, [otpComplete])

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: tokens.colors.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: tokens.colors.surface,
          border: `1px solid ${tokens.colors.border}`,
          borderRadius: tokens.radius.card,
          padding: 40,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
        }}
      >
        {/* Logo mark */}
        <Logo variant="mark" size={40} />

        {/* Title */}
        <div style={{ textAlign: 'center' }}>
          <h1
            data-cms-key="login.title"
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: tokens.colors.text,
              margin: 0,
            }}
          >
            歡迎回來
          </h1>
          <p
            data-cms-key="login.subtitle"
            style={{
              fontSize: 14,
              color: tokens.colors.textMuted,
              margin: '8px 0 0',
            }}
          >
            登入你的 248 Snooker 帳戶
          </p>
        </div>

        {step === 'methods' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Apple Sign In */}
            <button
              style={{
                width: '100%',
                height: 56,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                background: '#000',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 14,
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: tokens.font.sans,
              }}
            >
              <AppleLogo size={20} color="#fff" />
              <span data-cms-key="login.apple">以 Apple 登入</span>
            </button>

            {/* Google Sign In */}
            <button
              style={{
                width: '100%',
                height: 56,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                background: '#fff',
                color: '#1f1f1f',
                border: 'none',
                borderRadius: 14,
                fontSize: 16,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: tokens.font.sans,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://developers.google.com/identity/images/g-logo.png"
                alt="Google"
                width={20}
                height={20}
                style={{ display: 'block' }}
              />
              <span data-cms-key="login.google">以 Google 帳戶登入</span>
            </button>

            {/* Divider */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                margin: '4px 0',
              }}
            >
              <div style={{ flex: 1, height: 1, background: tokens.colors.border }} />
              <span
                data-cms-key="login.divider"
                style={{ fontSize: 13, color: tokens.colors.textMuted }}
              >
                或
              </span>
              <div style={{ flex: 1, height: 1, background: tokens.colors.border }} />
            </div>

            {/* WhatsApp OTP */}
            <div style={{ display: 'flex', gap: 8 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: tokens.colors.brandDim,
                  border: `1px solid ${tokens.colors.brand}`,
                  borderRadius: tokens.radius.input,
                  padding: '0 12px',
                  fontSize: 14,
                  fontWeight: 600,
                  color: tokens.colors.brand,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                +852
              </div>
              <Input
                inputMode="numeric"
                placeholder="電話號碼"
                maxLength={8}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              />
            </div>

            {phoneValid && (
              <Button variant="primary" size="md" fullWidth onClick={handleSendOtp}>
                傳送驗證碼
              </Button>
            )}
          </div>
        )}

        {step === 'otp' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
            <p style={{ fontSize: 14, color: tokens.colors.textMuted, textAlign: 'center', margin: 0 }}>
              驗證碼已發送至 +852 {phone}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  style={{
                    width: 44,
                    height: 52,
                    textAlign: 'center',
                    fontSize: 20,
                    fontWeight: 600,
                    color: tokens.colors.text,
                    background: 'rgba(255,255,255,0.06)',
                    border: `1px solid ${digit ? tokens.colors.brand : tokens.colors.border}`,
                    borderRadius: tokens.radius.input,
                    outline: 'none',
                    fontFamily: tokens.font.sans,
                    transition: `border-color ${tokens.duration.fast}`,
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = tokens.colors.brand
                  }}
                  onBlur={(e) => {
                    if (!digit) e.currentTarget.style.borderColor = tokens.colors.border
                  }}
                />
              ))}
            </div>
            <button
              onClick={() => { setStep('methods'); setOtp(Array(6).fill('')) }}
              style={{
                background: 'none',
                border: 'none',
                color: tokens.colors.textMuted,
                fontSize: 13,
                cursor: 'pointer',
                textDecoration: 'underline',
                fontFamily: tokens.font.sans,
              }}
            >
              返回
            </button>
          </div>
        )}

        {/* Footer note */}
        <p
          data-cms-key="login.footer"
          style={{
            fontSize: 12,
            color: tokens.colors.textMuted,
            textAlign: 'center',
            margin: 0,
          }}
        >
          還未有帳戶？預訂時自動建立。
        </p>
      </div>
    </div>
  )
}
