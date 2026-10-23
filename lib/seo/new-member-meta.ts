import 'server-only'
import { unstable_cache } from 'next/cache'
import { getNewMemberOffer } from '@/lib/pricing/new-member-offer'

// Metadata-only "new members from HK$X" wording. Appended to <meta description>
// and og/twitter descriptions; never rendered in the page UI.
// The price is derived from config + the active new-member promo (see
// getNewMemberOffer) and is null once that promo expires, so the wording drops
// out by itself. The promo code is deliberately never included.

const LINE: Record<string, (price: number) => string> = {
  'zh-HK': (p) => `新會員價錢低至 HK$${p}（需使用新會員優惠）。`,
  'zh-CN': (p) => `新会员价格低至 HK$${p}（需使用新会员优惠）。`,
  en: (p) => `New members from HK$${p} (new-member offer required).`,
}

const getFloorPrice = unstable_cache(
  async (): Promise<number | null> => {
    try {
      const offer = await getNewMemberOffer()
      return offer ? offer.floorPrice : null
    } catch {
      return null
    }
  },
  ['new-member-floor-price'],
  { revalidate: 3600 }
)

export async function withNewMemberDescription(locale: string, description: string): Promise<string> {
  const price = await getFloorPrice()
  if (price === null) return description
  const line = (LINE[locale] ?? LINE['zh-HK'])(price)
  return locale === 'en' ? `${description} ${line}` : `${description}${line}`
}
