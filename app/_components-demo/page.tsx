'use client'

import { useState } from 'react'
import { tokens } from '@/app/styles/tokens'
import { Button, Card, Input, Spinner, ProgressSteps, Sheet } from '@/components/ui'
import {
  ApplePayLogo,
  GooglePayLogo,
  AlipayLogo,
  WeChatPayLogo,
  VisaLogo,
  MastercardLogo,
  AppleLogo,
} from '@/components/brand'

export default function ComponentsDemo() {
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <div style={{ padding: '48px 20px', maxWidth: 800, margin: '0 auto' }}>
      <h1
        style={{
          fontSize: '32px',
          fontWeight: 700,
          marginBottom: '48px',
          color: tokens.colors.text,
        }}
      >
        Component Library
      </h1>

      {/* Buttons */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px', color: tokens.colors.text }}>
          Buttons
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <Button variant="primary" size="lg">
            Primary Large
          </Button>
          <Button variant="primary" size="md">
            Primary Medium
          </Button>
          <Button variant="primary" size="sm">
            Primary Small
          </Button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginTop: '16px' }}>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link Style</Button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginTop: '16px' }}>
          <Button variant="primary" loading>
            Loading
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
        <div style={{ marginTop: '16px', maxWidth: '320px' }}>
          <Button variant="primary" fullWidth>
            Full Width
          </Button>
        </div>
        <div style={{ marginTop: '16px' }}>
          <Button variant="primary" leftIcon={<AppleLogo size={18} />}>
            以 Apple 繼續
          </Button>
        </div>
      </section>

      {/* Inputs */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px', color: tokens.colors.text }}>
          Inputs
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px' }}>
          <Input label="姓名" placeholder="輸入你嘅姓名" />
          <Input
            label="電話"
            placeholder="9XXX XXXX"
            inputMode="tel"
            leftSlot={
              <span
                style={{
                  fontSize: '14px',
                  color: tokens.colors.textMuted,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  padding: '4px 8px',
                  borderRadius: tokens.radius.pill,
                }}
              >
                +852
              </span>
            }
          />
          <Input label="有錯誤嘅 Input" placeholder="..." error="呢個欄位係必填" />
        </div>
      </section>

      {/* Cards */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px', color: tokens.colors.text }}>
          Cards
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          <Card>
            <p style={{ color: tokens.colors.text, margin: 0 }}>Default Card</p>
            <p style={{ color: tokens.colors.textMuted, margin: '8px 0 0', fontSize: '14px' }}>
              Surface background with border
            </p>
          </Card>
          <Card variant="elevated">
            <p style={{ color: tokens.colors.text, margin: 0 }}>Elevated Card</p>
            <p style={{ color: tokens.colors.textMuted, margin: '8px 0 0', fontSize: '14px' }}>
              Elevated surface for layered UI
            </p>
          </Card>
        </div>
      </section>

      {/* Spinner */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px', color: tokens.colors.text }}>
          Spinner
        </h2>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <Spinner size={32} />
          <Spinner size={48} />
          <Spinner size={64} />
        </div>
      </section>

      {/* Progress Steps */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px', color: tokens.colors.text }}>
          Progress Steps
        </h2>
        <div style={{ maxWidth: '400px' }}>
          <ProgressSteps steps={['日期', '時間', '資料', '付款']} current={1} />
        </div>
      </section>

      {/* Payment Logos */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px', color: tokens.colors.text }}>
          Payment Logos
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
          <ApplePayLogo />
          <GooglePayLogo />
          <AlipayLogo />
          <WeChatPayLogo />
          <VisaLogo />
          <MastercardLogo />
        </div>
      </section>

      {/* Sheet */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px', color: tokens.colors.text }}>
          Sheet / Modal
        </h2>
        <Button variant="secondary" onClick={() => setSheetOpen(true)}>
          Open Sheet
        </Button>
        <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: tokens.colors.text, marginBottom: '12px' }}>
            Sheet Content
          </h3>
          <p style={{ color: tokens.colors.textMuted, fontSize: '14px', lineHeight: 1.6 }}>
            呢個係 bottom sheet (mobile) 或 centered modal (desktop)。
            背後有 overlay，頂部有 drag handle。
          </p>
          <div style={{ marginTop: '24px' }}>
            <Button variant="primary" fullWidth onClick={() => setSheetOpen(false)}>
              確認
            </Button>
          </div>
        </Sheet>
      </section>
    </div>
  )
}
