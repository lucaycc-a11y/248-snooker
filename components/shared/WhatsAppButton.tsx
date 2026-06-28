'use client'

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'

const WHATSAPP_URL = 'https://wa.me/85264274620'

/**
 * Floating WhatsApp contact button — mobile only (md:hidden).
 * Fixed bottom-right, 56px circle, WhatsApp brand green (#25D366).
 * Tooltip on hover/long-press: "WhatsApp 我哋".
 */
export default function WhatsAppButton() {
  const [showTip, setShowTip] = useState(false)

  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp 我哋"
      className="md:hidden"
      onTouchStart={() => setShowTip(true)}
      onTouchEnd={() => setShowTip(false)}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 50,
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        background: '#25D366',
        color: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <MessageCircle size={28} strokeWidth={2} color="#000000" />

      {/* Tooltip */}
      <span
        role="tooltip"
        style={{
          position: 'absolute',
          right: '64px',
          top: '50%',
          transform: 'translateY(-50%)',
          whiteSpace: 'nowrap',
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.2)',
          color: '#FFFFFF',
          fontSize: '13px',
          fontWeight: 500,
          padding: '6px 12px',
          borderRadius: '999px',
          opacity: showTip ? 1 : 0,
          pointerEvents: 'none',
          transition: 'opacity 150ms ease',
        }}
      >
        WhatsApp 我哋
      </span>
    </a>
  )
}
