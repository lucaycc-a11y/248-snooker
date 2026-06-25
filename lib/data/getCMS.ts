const mockCMS: Record<string, string> = {
  'hero.title': '248 Snooker Club',
  'hero.subtitle': '24小時私人桌球會所',
  'booking.title': '預訂桌枱',
  'pricing.title': '價格',
  'nav.book': '預訂',
  'nav.pricing': '定價',
  'nav.about': '關於',
  'nav.blog': 'Blog',
  'nav.cta': '立即預訂',
  'footer.product': '產品',
  'footer.company': '公司',
  'footer.legal': '法律',
  'footer.social': '社交',
}

// TODO: connect Supabase
export async function getCMS(key: string): Promise<string> {
  return mockCMS[key] ?? key
}
