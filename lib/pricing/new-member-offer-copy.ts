import 'server-only'
import type { NewMemberOffer } from '@/lib/pricing/new-member-offer'

// Preview copy for the "new members from HK$X" message.
// Deliberately NOT in messages/*.json: those files are shipped whole to every
// browser through NextIntlClientProvider, which would expose the copy to anyone
// reading the page source. This module is server-only and is returned solely by
// /api/internal/new-member-offer (super_admin only).
// At public release, move these strings into messages/ with data-cms-key.

export type NewMemberOfferText = {
  preview_badge: string
  line: string
  detail: string
  faq_q: string
  faq_a: string
}

type Params = { price: number; base: number; code: string; promo: number; credit: number }

const COPY: Record<string, (p: Params) => NewMemberOfferText> = {
  'zh-HK': (p) => ({
    preview_badge: '預覽｜只有 Super Admin 睇到',
    line: `新會員價錢低至 HK$${p.price}（需使用新會員優惠）`,
    detail: `以最低時段價 HK$${p.base} 計，已扣新會員優惠碼 ${p.code} −HK$${p.promo}，及迎新 Space Credit −HK$${p.credit}。每位新會員只限使用一次。`,
    faq_q: '新會員有咩優惠？',
    faq_a: `新會員價錢低至 HK$${p.price}（需使用新會員優惠）：以最低時段價 HK$${p.base} 計，使用新會員優惠碼 ${p.code} 減 HK$${p.promo}，再加迎新積分兌換嘅 HK$${p.credit} Space Credit。優惠只限新會員，每人一次。`,
  }),
  'zh-CN': (p) => ({
    preview_badge: '预览｜只有 Super Admin 看到',
    line: `新会员价格低至 HK$${p.price}（需使用新会员优惠）`,
    detail: `以最低时段价 HK$${p.base} 计，已扣新会员优惠码 ${p.code} −HK$${p.promo}，及迎新 Space Credit −HK$${p.credit}。每位新会员仅限使用一次。`,
    faq_q: '新会员有什么优惠？',
    faq_a: `新会员价格低至 HK$${p.price}（需使用新会员优惠）：以最低时段价 HK$${p.base} 计，使用新会员优惠码 ${p.code} 减 HK$${p.promo}，再加迎新积分兑换的 HK$${p.credit} Space Credit。优惠仅限新会员，每人一次。`,
  }),
  en: (p) => ({
    preview_badge: 'Preview — super admins only',
    line: `New members pay as low as HK$${p.price} (new-member offer required)`,
    detail: `Based on the lowest-rate slot at HK$${p.base}, after new-member code ${p.code} (−HK$${p.promo}) and the welcome Space Credit (−HK$${p.credit}). One use per new member.`,
    faq_q: 'What do new members get?',
    faq_a: `New members pay as low as HK$${p.price} (new-member offer required): from the lowest-rate slot at HK$${p.base}, apply new-member code ${p.code} for HK$${p.promo} off, plus HK$${p.credit} of Space Credit from the welcome points. New members only, once per person.`,
  }),
}

export function newMemberOfferText(locale: string, offer: NewMemberOffer): NewMemberOfferText {
  const make = COPY[locale] ?? COPY['zh-HK']
  return make({
    price: offer.floorPrice,
    base: offer.basePrice,
    code: offer.promoCode ?? '',
    promo: offer.promoDiscount,
    credit: offer.creditAmount,
  })
}
