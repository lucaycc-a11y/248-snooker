'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Monitor, RefreshCw, Smartphone, Tablet, X } from 'lucide-react'
import { adminTokens as tokens } from '@/lib/admin/admin-tokens'

type Device = 'desktop' | 'tablet' | 'mobile'
const WIDTH: Record<Device, number | '100%'> = { desktop: '100%', tablet: 820, mobile: 390 }
const GT = "'Good Times', 'JetBrains Mono', monospace"

/**
 * Slide-over that shows the real blog page (the admin-only /blog/preview/<id> route) in an iframe,
 * so what the editor sees is the public layout, fonts and CTAs — not an approximation.
 */
export default function BlogPreviewDrawer({ open, onClose, src, version, onRefresh, refreshing }: {
  open: boolean
  onClose: () => void
  src: string
  version: number
  onRefresh: () => void
  refreshing: boolean
}) {
  const [device, setDevice] = useState<Device>('desktop')

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])

  if (!open) return null

  const dev = (d: Device, Icon: typeof Monitor, label: string) => (
    <button key={d} type="button" aria-label={label} aria-pressed={device === d} onClick={() => setDevice(d)}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, border: `1px solid ${device === d ? tokens.colors.brand : 'transparent'}`, background: device === d ? tokens.colors.brandDim : 'transparent', color: tokens.colors.text, cursor: 'pointer' }}>
      <Icon size={16} aria-hidden />
    </button>
  )
  const iconBtn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, border: 'none', background: 'transparent', color: tokens.colors.text, cursor: 'pointer' } as const

  return (
    <div role="dialog" aria-modal="true" aria-label="文章預覽" style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', background: 'rgba(8,8,10,0.94)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: `1px solid ${tokens.colors.border}` }}>
        <span style={{ fontFamily: GT, fontSize: 11, letterSpacing: '0.16em', color: tokens.colors.brand, textTransform: 'uppercase', marginRight: 8 }}>Preview</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {dev('desktop', Monitor, '桌面')}
          {dev('tablet', Tablet, '平板')}
          {dev('mobile', Smartphone, '手機')}
        </div>
        <div style={{ flex: 1 }} />
        <button type="button" onClick={onRefresh} disabled={refreshing} style={{ ...iconBtn, width: 'auto', padding: '0 12px', gap: 6, fontSize: 13, fontWeight: 600, opacity: refreshing ? 0.6 : 1 }}>
          <RefreshCw size={15} aria-hidden />{refreshing ? '儲存中…' : '儲存並更新'}
        </button>
        <a href={src} target="_blank" rel="noopener noreferrer" aria-label="在新分頁開啟" style={{ ...iconBtn, textDecoration: 'none' }}><ExternalLink size={16} aria-hidden /></a>
        <button type="button" onClick={onClose} aria-label="關閉預覽" style={iconBtn}><X size={18} aria-hidden /></button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center', padding: device === 'desktop' ? 0 : 20, overflow: 'auto' }}>
        <iframe
          key={version}
          src={src}
          title="文章預覽"
          style={{ width: WIDTH[device], maxWidth: '100%', height: '100%', minHeight: device === 'desktop' ? undefined : 640, border: device === 'desktop' ? 'none' : `1px solid ${tokens.colors.border}`, borderRadius: device === 'desktop' ? 0 : 24, background: '#000', flexShrink: 0 }}
        />
      </div>
    </div>
  )
}
