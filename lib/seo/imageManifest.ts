/**
 * Public photo manifest — every content photo rendered on a public page.
 *
 * Used for image sitemap / JSON-LD. `src` is the path under /public and must
 * exist on disk with exact case (enforced by scripts/check-images.ts at build).
 * `alt` is descriptive zh-HK 書面語, 8–20 characters, naming what is in the photo.
 *
 * Excluded on purpose: logos, payment icons, leaflet markers, favicons, OG images
 * (metadata, not page content), the decorative 8-ball cut-out on /about, blog
 * covers (dynamic, from Supabase), preview-only routes and dead components.
 */

export type PublicPath =
  | '/'
  | '/venue'
  | '/about'
  | '/membership'
  | '/help-center'
  | '/blog'
  | '/book'

export type ManifestImage = {
  src: string
  alt: string
  pages: PublicPath[]
}

export const IMAGE_MANIFEST: readonly ManifestImage[] = [
  // ── Home ────────────────────────────────────────────────────────────────
  { src: '/video/Space8_Main_Hero_Poster.jpg', alt: 'SPACE8 中式桌球枱球袋與黑八球', pages: ['/'] },
  { src: '/images/qrcode-checkin-中八桌球-香港新蒲崗.webp', alt: 'SPACE8 牆上的二維碼掃描入場器', pages: ['/'] },
  { src: '/images/space8-booking-interface-pick-slot.webp', alt: '手機網上預訂介面選擇時段插圖', pages: ['/'] },
  { src: '/images/space8-qrcode-entry-system.webp', alt: '手機掃描二維碼自助入場插圖', pages: ['/'] },
  { src: '/images/space8-member-rewards-points.webp', alt: 'SPACE8 會員積分與獎勵插圖', pages: ['/'] },
  { src: '/gallery/spacepliot.png', alt: 'AI 智能對戰管家 iPad 計分畫面', pages: ['/', '/venue'] },

  // ── Shared venue photos (home / venue / book) ───────────────────────────
  { src: '/images/pool-table-closeup-中八桌球-香港新蒲崗.webp', alt: '星牌桌球枱球袋與枱面上的球', pages: ['/', '/venue', '/book'] },
  { src: '/images/pool-table-closeup-2-中八桌球-香港新蒲崗.webp', alt: '星牌中式桌球枱枱邊與枱布特寫', pages: ['/', '/venue', '/book'] },
  { src: '/images/space-infinity-room-中八桌球-香港新蒲崗.webp', alt: 'Infinity 房中式桌球枱全景', pages: ['/venue', '/book'] },
  { src: '/images/space-eternity-room-中八桌球-香港新蒲崗.webp', alt: 'Eternity 房中式桌球枱全景', pages: ['/venue', '/book'] },

  // ── Venue: cinematic orbit hero ─────────────────────────────────────────
  { src: '/images/venue-interior-中八桌球-香港新蒲崗.webp', alt: '托盤上的兩塊 Triangle 巧粉近照', pages: ['/venue'] },
  { src: '/images/space-pilot-scoreboard-中八桌球-香港新蒲崗.webp', alt: 'Space Pilot 智能計分系統畫面', pages: ['/venue'] },
  { src: '/images/cue-stand-中八桌球-香港新蒲崗.webp', alt: '靠牆擺放的專業球桿架', pages: ['/venue'] },
  { src: '/images/sofa-lounge-中八桌球-香港新蒲崗.webp', alt: '球室休息區扶手椅與球桿架', pages: ['/venue'] },

  // ── Venue: room viewer ──────────────────────────────────────────────────
  { src: '/images/venue-page-infinity.jpg', alt: 'Infinity 無限空間球室全景', pages: ['/venue'] },
  { src: '/images/venue-page-eternity.jpg', alt: 'Eternity 永恆空間球室全景', pages: ['/venue'] },
  { src: '/images/space8-infinity-room-lounge-sofa-armchair-side-table.webp', alt: 'Infinity 球室沙發扶手椅休息區', pages: ['/venue'] },
  { src: '/images/space8-eternity-room-lounge-black-sofa.webp', alt: 'Eternity 球室休息區黑色沙發', pages: ['/venue'] },
  { src: '/images/space8-eternity-room-bar-counter-black-stools.webp', alt: 'Eternity 球室吧台及黑色吧台凳', pages: ['/venue'] },
  { src: '/images/xing-pai-chinese-eight-ball-table-corner-pocket-hong-kong.webp', alt: '星牌桌球枱球袋與比賽用球近照', pages: ['/venue'] },
  { src: '/images/super-aramith-pro-tv-pro-cup-billiard-balls-space8.webp', alt: 'Aramith 比賽球及球盒', pages: ['/venue'] },
  { src: '/images/triangle-chalk-billiard-cue-chalk-space8.webp', alt: '托盤上的兩塊 Triangle 巧粉', pages: ['/venue'] },
  { src: '/images/space8-cue-rack-professional-cues-close-up.webp', alt: 'SPACE8 球桿架及專業球桿近照', pages: ['/venue'] },

  // ── About: space wheel ──────────────────────────────────────────────────
  { src: '/images/space8-about-photos/images/about-01-table-eight-ball.webp', alt: '球枱上的黑八球與散落的球', pages: ['/about'] },
  { src: '/images/space8-about-photos/images/about-02-felt-xingpai.webp', alt: '球枱絨布上的星牌刺繡標誌', pages: ['/about'] },
  { src: '/images/space8-about-photos/images/about-03-corner-pocket.webp', alt: '聚光燈下球枱一角的袋口與球', pages: ['/about'] },
  { src: '/images/space8-about-photos/images/about-04-cove-lighting.webp', alt: '球枱袋口與天花暖色間接燈光', pages: ['/about'] },
  { src: '/images/space8-about-photos/images/about-05-cue-rack.webp', alt: '牆邊球桿架與黑色高腳椅', pages: ['/about'] },
  { src: '/images/space8-about-photos/images/about-06-lounge.webp', alt: '球枱後方的扶手椅與沙發休息區', pages: ['/about'] },
  { src: '/images/space8-about-photos/images/about-07-stools.webp', alt: '球枱一角與兩張黑色高腳椅', pages: ['/about'] },
  { src: '/images/space8-about-photos/images/about-08-ball-rack.webp', alt: '三角架內排好的彩色桌球', pages: ['/about'] },
]

const PUBLIC_PATHS: readonly PublicPath[] = ['/', '/venue', '/about', '/membership', '/help-center', '/blog', '/book']

export function isPublicPath(path: string): path is PublicPath {
  return (PUBLIC_PATHS as readonly string[]).includes(path)
}

/** All manifest images that appear on the given public route (unknown routes → []). */
export function imagesForPage(path: PublicPath | string): ManifestImage[] {
  if (!isPublicPath(path)) return []
  return IMAGE_MANIFEST.filter((img) => img.pages.includes(path))
}

/** Best venue photos, for the JSON-LD `image` array. */
export const MAIN_PHOTOS: string[] = [
  '/images/space-infinity-room-中八桌球-香港新蒲崗.webp',
  '/images/space-eternity-room-中八桌球-香港新蒲崗.webp',
  '/images/space8-infinity-room-lounge-sofa-armchair-side-table.webp',
  '/images/xing-pai-chinese-eight-ball-table-corner-pocket-hong-kong.webp',
  '/images/space8-about-photos/images/about-01-table-eight-ball.webp',
  '/images/space8-about-photos/images/about-06-lounge.webp',
  '/images/space8-cue-rack-professional-cues-close-up.webp',
]
