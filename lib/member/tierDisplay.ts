/**
 * tierDisplay — single source of truth for membership tier display names.
 *
 * Tier IDs ('amateur' | 'century' | 'maximum') come from the config/pricing
 * layer; the enum values themselves must never appear in user-facing UI.
 *
 * Two display styles:
 *  - tierLabel(id, locale)  — localized long form for user-facing surfaces
 *    (AccountMenu, MemberDashboard, landing membership page).
 *  - tierShortLabel(id)     — short English for admin UI (narrow columns,
 *    English-only backend).
 *
 * Client-safe: no Supabase imports. lib/wallet/shared.ts re-exports
 * TIER_DISPLAY from here for backward compatibility.
 */

import type { Tier } from '@/lib/data/pricing'

export type TierDisplayName = { zhHK: string; zhCN: string; en: string }

export const TIER_DISPLAY: Record<Tier['id'], TierDisplayName> = {
  amateur: { zhHK: '標準會員', zhCN: '标准会员', en: 'Standard Member' },
  century: { zhHK: '優越會員', zhCN: '优越会员', en: 'Premier Member' },
  maximum: { zhHK: '尊榮會員', zhCN: '尊荣会员', en: 'Prestige Member' },
}

/** Short English labels for the admin backend (spec §9). */
const TIER_SHORT_LABELS: Record<Tier['id'], string> = {
  amateur: 'Standard',
  century: 'Premier',
  maximum: 'Prestige',
}

const TIER_IDS = Object.keys(TIER_DISPLAY) as Tier['id'][]

/** Type guard: raw DB/string value → known tier id. */
export function isTierId(value: unknown): value is Tier['id'] {
  return typeof value === 'string' && (TIER_IDS as string[]).includes(value)
}

/**
 * Long-form tier name for the active locale.
 * Falls back to zh-HK for unknown locales, or the raw id if it is not a
 * known tier (defensive — never renders a blank).
 */
export function tierLabel(id: string | null | undefined, locale: string): string {
  if (!isTierId(id)) return id ?? ''
  if (locale.startsWith('zh-CN')) return TIER_DISPLAY[id].zhCN
  if (locale.startsWith('en')) return TIER_DISPLAY[id].en
  return TIER_DISPLAY[id].zhHK
}

/** Short English tier name for admin UI. Falls back to the raw id. */
export function tierShortLabel(id: string | null | undefined): string {
  if (!isTierId(id)) return id ?? ''
  return TIER_SHORT_LABELS[id]
}
