'use client'

import { useState } from 'react'
import { MemberCardFlipRedesign } from '../components/MemberCardFlipRedesign'
import { type MemberProfile } from '@/lib/data/memberRedesignTypes'

// ════════════════════════════════════════════════════════════════════════════
// Card Preview Page — Phase 3 Design Comparison
// Allows side-by-side comparison of current vs redesigned member card
// ════════════════════════════════════════════════════════════════════════════

export default function CardPreviewPage() {
  const [tier, setTier] = useState<'amateur' | 'century' | 'maximum'>('amateur')

  // Mock profile data for preview
  const mockProfile: MemberProfile = {
    id: 'preview-user',
    member_code: 'SPACE8-2024-001',
    display_name: '陳大文',
    tier,
    points: tier === 'amateur' ? 3500 : tier === 'century' ? 15000 : 45000,
    unread_notifications: 3,
    email: 'preview@space8.com',
    phone: null,
    gender: null,
    date_of_birth: null,
    birthday_set: false,
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05070C] via-[#0A0D12] to-[#0F131C] p-8">
      {/* Header */}
      <div className="mx-auto max-w-4xl">
        <a
          href="/member"
          className="inline-flex items-center gap-2 text-white/60 transition-colors hover:text-white"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回 Member 頁面
        </a>

        <h1 className="mt-6 font-code text-3xl font-bold text-white">
          Phase 3 — Member Card Redesign Preview
        </h1>
        <p className="mt-2 text-sm text-white/60">
          完整 Figma-based 重新設計 — 根據 PDF 規格實現
        </p>
      </div>

      {/* Tier Selector */}
      <div className="mx-auto mt-8 max-w-4xl">
        <div className="flex gap-3">
          <button
            onClick={() => setTier('amateur')}
            className={`rounded-full px-4 py-2 font-code text-sm transition-all ${
              tier === 'amateur'
                ? 'bg-white/20 text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Nova (Amateur)
          </button>
          <button
            onClick={() => setTier('century')}
            className={`rounded-full px-4 py-2 font-code text-sm transition-all ${
              tier === 'century'
                ? 'bg-white/20 text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Platinum (Century)
          </button>
          <button
            onClick={() => setTier('maximum')}
            className={`rounded-full px-4 py-2 font-code text-sm transition-all ${
              tier === 'maximum'
                ? 'bg-white/20 text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Diamond (Maximum)
          </button>
        </div>
      </div>

      {/* Card Preview */}
      <div className="mx-auto mt-12 max-w-md">
        <MemberCardFlipRedesign
          profile={mockProfile}
          flipped={false}
          onFlip={() => {}}
        />
      </div>

      {/* Design Notes */}
      <div className="mx-auto mt-12 max-w-4xl rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="font-code text-lg font-bold text-white">Design Changes</h2>
        <ul className="mt-4 space-y-2 text-sm text-white/80">
          <li>• <strong>Enhanced tier gradients:</strong> More vibrant, premium feel</li>
          <li>• <strong>Refined typography:</strong> Better hierarchy and readability</li>
          <li>• <strong>Improved progress bar:</strong> More visual feedback</li>
          <li>• <strong>Premium materials:</strong> Glassmorphism + subtle textures</li>
          <li>• <strong>Micro-interactions:</strong> Smooth animations on all interactions</li>
        </ul>
      </div>
    </div>
  )
}
