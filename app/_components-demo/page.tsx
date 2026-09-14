'use client'

import { useState } from 'react'
import { tokens } from '@/app/styles/tokens'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { RefreshCw } from 'lucide-react'
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
          <Button variant="default" size="lg">
            Default Large
          </Button>
          <Button variant="default" size="default">
            Default Medium
          </Button>
          <Button variant="default" size="sm">
            Default Small
          </Button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginTop: '16px' }}>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link Style</Button>
          <Button variant="secondary">Destructive</Button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginTop: '16px' }}>
          <Button variant="default" disabled>
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Loading
          </Button>
          <Button variant="default" disabled>
            Disabled
          </Button>
        </div>
        <div style={{ marginTop: '16px', maxWidth: '320px' }}>
          <Button variant="default" className="w-full">
            Full Width
          </Button>
        </div>
        <div style={{ marginTop: '16px' }}>
          <Button variant="default">
            <AppleLogo size={18} />
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
          <div>
            <label className="text-sm font-medium mb-2 block">姓名</label>
            <Input placeholder="輸入你嘅姓名" />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">電話</label>
            <Input placeholder="9XXX XXXX" type="tel" />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">有錯誤嘅 Input</label>
            <Input placeholder="..." className="border-destructive" />
            <p className="text-sm text-destructive mt-1">呢個欄位係必填</p>
          </div>
        </div>
      </section>

      {/* Cards */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px', color: tokens.colors.text }}>
          Cards
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          <Card>
            <CardContent className="pt-6">
              <p className="text-foreground m-0">Default Card</p>
              <p className="text-muted-foreground mt-2 text-sm">Surface background with border</p>
            </CardContent>
          </Card>
          <Card className="shadow-lg">
            <CardContent className="pt-6">
              <p className="text-foreground m-0">Elevated Card</p>
              <p className="text-muted-foreground mt-2 text-sm">Elevated surface for layered UI</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Spinner */}
      <section style={{ marginBottom: '48px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px', color: tokens.colors.text }}>
          Spinner
        </h2>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <RefreshCw className="h-8 w-8 animate-spin" />
          <RefreshCw className="h-12 w-12 animate-spin" />
          <RefreshCw className="h-16 w-16 animate-spin" />
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
            <Button variant="default" className="w-full" onClick={() => setSheetOpen(false)}>
              確認
            </Button>
          </div>
        </Sheet>
      </section>
    </div>
  )
}
