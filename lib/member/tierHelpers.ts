// ════════════════════════════════════════════════════════════════════════════
// Tier Helpers — Display names, colors, gradients for real tier values
// Uses actual DB tier values: 'amateur' | 'century' | 'maximum'
// ════════════════════════════════════════════════════════════════════════════

import type { TierValue, TierDefinition } from '@/lib/data/memberRedesignTypes'

// Tier display names (Luca-confirmed)
export const TIER_NAMES: Record<TierValue, TierDefinition> = {
  amateur: {
    id: 'amateur',
    name_zh_hk: '標準會員',
    name_zh_cn: '标准会员',
    name_en: 'Standard',
    name_ja: 'スタンダード',
  },
  century: {
    id: 'century',
    name_zh_hk: '優越會員',
    name_zh_cn: '优越会员',
    name_en: 'Premier',
    name_ja: 'プレミア',
  },
  maximum: {
    id: 'maximum',
    name_zh_hk: '尊榮會員',
    name_zh_cn: '尊荣会员',
    name_en: 'Prestige',
    name_ja: 'プレステージ',
  },
}

// Get localized tier name
export function getTierName(tier: TierValue, locale: string): string {
  const def = TIER_NAMES[tier]
  if (!def) return tier

  switch (locale) {
    case 'zh-HK':
      return def.name_zh_hk
    case 'zh-CN':
      return def.name_zh_cn
    case 'ja':
      return def.name_ja
    case 'en':
    default:
      return def.name_en
  }
}

// Tier badge colors (Tailwind classes)
export function getTierColor(tier: TierValue): string {
  switch (tier) {
    case 'amateur':
      return 'bg-blue-500' // Nova blue
    case 'century':
      return 'bg-gray-300' // Platinum silver
    case 'maximum':
      return 'bg-purple-500' // Diamond purple
    default:
      return 'bg-gray-500'
  }
}

// Tier card gradient (CSS gradient strings)
export function getTierGradient(tier: TierValue): string {
  switch (tier) {
    case 'amateur':
      return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' // Blue-purple
    case 'century':
      return 'linear-gradient(135deg, #bdc3c7 0%, #2c3e50 100%)' // Silver-dark
    case 'maximum':
      return 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' // Pink-purple
    default:
      return 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'
  }
}

// Tier ring color (for progress ring UI)
export function getTierRingColor(tier: TierValue): string {
  switch (tier) {
    case 'amateur':
      return '#667eea' // Nova blue
    case 'century':
      return '#bdc3c7' // Platinum silver
    case 'maximum':
      return '#f093fb' // Diamond pink
    default:
      return '#6b7280'
  }
}

// Get tier short label (for compact UI)
export function getTierShortLabel(tier: TierValue): string {
  switch (tier) {
    case 'amateur':
      return 'Standard'
    case 'century':
      return 'Premier'
    case 'maximum':
      return 'Prestige'
    default:
      return tier
  }
}

// Get tier definition with all localized names
export function getTierDefinition(tier: TierValue): TierDefinition {
  return TIER_NAMES[tier] || TIER_NAMES.amateur
}
