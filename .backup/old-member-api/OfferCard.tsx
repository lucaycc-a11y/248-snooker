'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslations, useLocale } from 'next-intl'
import { type UserCoupon, type CouponTemplate } from '@/lib/data/memberRedesignTypes'

// ════════════════════════════════════════════════════════════════════════════
// OfferCard — P3/P4: Display and interact with coupons (UserCoupon or CouponTemplate)
// FIXED: Uses real schema (user_coupons, coupon_templates)
// ════════════════════════════════════════════════════════════════════════════

type Props = {
  offer: UserCoupon | CouponTemplate
  variant?: 'default' | 'compact' | 'history' | 'catalog'
  onRefresh: () => void
}

export function OfferCard({ offer, variant = 'default', onRefresh }: Props) {
  const t = useTranslations('member.offers')
  const locale = useLocale()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isUserCoupon = 'user_id' in offer
  const isCatalogTemplate = variant === 'catalog'

  const title = getLocalizedField(offer, 'title', locale)
  const description = getLocalizedField(offer, 'description', locale)

  const handleRedeem = async () => {
    if (!isCatalogTemplate) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/member/redeem-coupon-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: offer.id }),
      })
      const result = await res.json()
      if (result.success) {
        onRefresh()
      } else {
        setError(result.error ?? 'unknown_error')
      }
    } catch {
      setError('network_error')
    } finally {
      setLoading(false)
    }
  }

  const isExpired =
    isUserCoupon && (offer as UserCoupon).expires_at && new Date((offer as UserCoupon).expires_at!) < new Date()

  // Compact variant for previews
  if (variant === 'compact') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 p-4 backdrop-blur-xl"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="font-bold text-white">{title}</h4>
            <p className="mt-1 text-sm text-white/60">{getDiscountText(offer, t)}</p>
          </div>
          {isUserCoupon && <CouponBadge coupon={offer as UserCoupon} />}
        </div>
        {isUserCoupon && (offer as UserCoupon).expires_at && (
          <p className="mt-2 text-xs text-white/40">
            {t('expires')}: {new Date((offer as UserCoupon).expires_at!).toLocaleDateString(locale)}
          </p>
        )}
      </motion.div>
    )
  }

  // History variant (minimal)
  if (variant === 'history' && isUserCoupon) {
    const coupon = offer as UserCoupon
    return (
      <div className="rounded-xl border border-white/5 bg-white/5 p-4 backdrop-blur opacity-60">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="text-sm font-medium text-white">{title}</h4>
            <p className="mt-1 text-xs text-white/40">{getDiscountText(offer, t)}</p>
          </div>
          <CouponBadge coupon={coupon} />
        </div>
        {coupon.used_at && (
          <p className="mt-2 text-xs text-white/30">
            {t('used_at')}: {new Date(coupon.used_at).toLocaleDateString(locale)}
          </p>
        )}
      </div>
    )
  }

  // Catalog variant (template card with points cost)
  if (variant === 'catalog' && !isUserCoupon) {
    const template = offer as CouponTemplate
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/10 to-white/5 p-6 backdrop-blur-xl transition-all hover:from-white/15 hover:to-white/10"
      >
        <div className="pr-4">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          {description && <p className="mt-2 text-sm text-white/60">{description}</p>}

          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-baseline gap-2">
              <span className="font-code text-3xl text-white">{getDiscountDisplay(offer)}</span>
              <span className="font-label text-sm text-white/40">{getDiscountUnit(offer, t)}</span>
            </div>
          </div>

          {offer.min_booking_hours && (
            <p className="font-label mt-2 text-xs text-white/40">
              {t('min_hours')}: <span className="font-code">{offer.min_booking_hours}h</span>
            </p>
          )}
        </div>

        {/* Redeem button */}
        <div className="mt-6 space-y-2">
          {error && (
            <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-red-400">
              {t(`errors.${error}`)}
            </motion.p>
          )}

          {template.points_cost != null && template.points_cost > 0 ? (
            <button
              onClick={handleRedeem}
              disabled={loading}
              className="font-label w-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 text-white transition-all hover:from-purple-600 hover:to-pink-600 disabled:opacity-50"
            >
              {loading ? t('redeeming') : `${t('redeem_for')} ${template.points_cost.toLocaleString()} ${t('points')}`}
            </button>
          ) : (
            <div className="font-label rounded-full border border-green-500/30 bg-green-500/10 px-6 py-3 text-center text-sm text-green-300">
              {t('free_to_claim')}
            </div>
          )}
        </div>
      </motion.div>
    )
  }

  // Default variant (full coupon card for user's coupons)
  if (!isUserCoupon) return null
  const coupon = offer as UserCoupon

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/10 to-white/5 p-6 backdrop-blur-xl transition-all hover:from-white/15 hover:to-white/10"
    >
      {/* Badge */}
      <div className="absolute right-4 top-4">
        <CouponBadge coupon={coupon} />
      </div>

      {/* Content */}
      <div className="pr-16">
        <h3 className="text-xl font-bold text-white">{title}</h3>
        {description && <p className="mt-2 text-sm text-white/60">{description}</p>}

        <div className="mt-4 flex items-center gap-4">
          <div className="flex items-baseline gap-2">
            <span className="font-code text-3xl text-white">{getDiscountDisplay(offer)}</span>
            <span className="font-label text-sm text-white/40">{getDiscountUnit(offer, t)}</span>
          </div>
        </div>

        {offer.min_booking_hours && (
          <p className="font-label mt-2 text-xs text-white/40">
            {t('min_hours')}: <span className="font-code">{offer.min_booking_hours}h</span>
          </p>
        )}

        {coupon.expires_at && (
          <p className="mt-2 text-xs text-white/40">
            {t('expires')}: {new Date(coupon.expires_at).toLocaleDateString(locale)}
          </p>
        )}

        <p className="font-code mt-2 text-xs text-white/40">
          {t('code')}: {coupon.code}
        </p>
      </div>

      {/* Actions */}
      <div className="mt-6 space-y-2">
        {coupon.status === 'available' && !isExpired && (
          <button
            onClick={() => {
              // Navigate to booking with coupon pre-selected
              window.location.href = `/booking?coupon=${coupon.code}`
            }}
            className="font-label w-full rounded-full bg-gradient-to-r from-green-500 to-emerald-500 px-6 py-3 text-white transition-all hover:from-green-600 hover:to-emerald-600"
          >
            {t('use_coupon')}
          </button>
        )}

        {coupon.status === 'reserved' && (
          <div className="font-label rounded-full border border-amber-500/30 bg-amber-500/10 px-6 py-3 text-center text-sm text-amber-300">
            {t('reserved_in_booking')}
          </div>
        )}

        {isExpired && (
          <div className="font-label rounded-full border border-white/10 bg-white/5 px-6 py-3 text-center text-sm text-white/40">
            {t('expired')}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § COUPON BADGE
// ────────────────────────────────────────────────────────────────────────────

function CouponBadge({ coupon }: { coupon: UserCoupon }) {
  const t = useTranslations('member.offers')

  const getBadgeStyle = () => {
    switch (coupon.status) {
      case 'available':
        return 'bg-green-500/20 text-green-300 border-green-500/30'
      case 'reserved':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
      case 'used':
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30'
      case 'expired':
        return 'bg-red-500/20 text-red-300 border-red-500/30'
      default:
        return 'bg-white/10 text-white/60 border-white/10'
    }
  }

  return (
    <div className={`font-label rounded-full border px-3 py-1 text-xs ${getBadgeStyle()}`}>
      {t(`status.${coupon.status}`)}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § HELPERS
// ────────────────────────────────────────────────────────────────────────────

function getLocalizedField(
  offer: UserCoupon | CouponTemplate,
  field: 'title' | 'description',
  locale: string
): string {
  const localeMap: Record<string, string> = {
    'zh-HK': 'zh_hk',
    'zh-CN': 'zh_cn',
    en: 'en',
    ja: 'ja',
  }
  const suffix = localeMap[locale] ?? 'en'
  const key = `${field}_${suffix}` as keyof (UserCoupon | CouponTemplate)
  return (offer[key] as string) ?? (offer[`${field}_en` as keyof (UserCoupon | CouponTemplate)] as string) ?? ''
}

function getDiscountText(offer: UserCoupon | CouponTemplate, t: any): string {
  switch (offer.discount_type) {
    case 'fixed':
      return `HK$${offer.discount_value} ${t('discount_types.off')}`
    case 'percent':
      return `${offer.discount_value}% ${t('discount_types.off')}`
    case 'free_hour':
      return `${offer.discount_value}h ${t('discount_types.free')}`
    default:
      return ''
  }
}

function getDiscountDisplay(offer: UserCoupon | CouponTemplate): string {
  switch (offer.discount_type) {
    case 'fixed':
      return `$${offer.discount_value}`
    case 'percent':
      return `${offer.discount_value}%`
    case 'free_hour':
      return `${offer.discount_value}h`
    default:
      return ''
  }
}

function getDiscountUnit(offer: UserCoupon | CouponTemplate, t: any): string {
  switch (offer.discount_type) {
    case 'fixed':
      return t('units.off')
    case 'percent':
      return t('units.off')
    case 'free_hour':
      return t('units.free')
    default:
      return ''
  }
}
