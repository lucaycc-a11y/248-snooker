/**
 * Room Viewer data (zh-HK).
 *
 * Everything the section shows lives in this one file: copy, image paths, alt text, sizes, focal points.
 * Edit text or swap photos here; the component does not need to change.
 *
 * Images: put the SEO WebP files from the zip in /public/images/ (keep the `clean-no-title/` sub-folder).
 * Alt text and sizes come from alt-text-manifest.csv.
 */

export interface Img {
  /** Public URL, e.g. /images/foo.webp */
  src: string
  /** zh-HK alt text (from the SEO manifest) */
  alt: string
  /** Intrinsic size in px. Used for the width/height attributes (prevents layout shift). */
  width: number
  height: number
  /** CSS object-position focal point, e.g. "56% 62%" */
  pos?: string
}

export interface EternityView extends Img {
  key: 'sofa' | 'bar'
  label: string
}

export interface ProductView extends Img {
  key: string
  /** Thumbnail label and the small label on the stage */
  label: string
  /** Product name shown on the stage chip */
  title: string
  /** One-line detail under the thumbnails */
  sub?: string
  /** Spec rows [term, value] */
  rows?: [string, string][]
}

export type IconKey = 'spark' | 'timer' | 'bars' | 'play'

export interface PilotPoint {
  icon: IconKey
  name: string
  desc: string
  tag?: string
}

export interface PillData {
  id: string
  name: string
  main: string
  tag?: string
  /** Two-room compare: Infinity on the left, Eternity on the right of the divider. */
  compare?: { infinity: Img; eternity: Img | EternityView[] }
  /** One photo per product, chosen with thumbnails. */
  views?: ProductView[]
  /** Space Pilot stage + description. */
  pilot?: { image: Img; intro: string; points: PilotPoint[] }
}

export interface RoomViewerData {
  title: string
  hint: string
  rooms: {
    infinity: { name: string; zh: string; label: string }
    eternity: { name: string; zh: string; label: string }
  }
  pills: PillData[]
}

/* ─────────────── images ─────────────── */

/**
 * 場地裝修 panoramas.
 * 'clean'  → the photos WITHOUT title text (use these with the compare divider).
 * 'titled' → the venue-page-*.jpg versions with "SPACE INFINITY / SPACE ETERNITY" printed in the picture.
 *            The divider cuts that text in half, so only use 'titled' if you do not use the compare.
 */
const PANORAMA_SET: 'clean' | 'titled' = 'titled'

const PANORAMA = {
  clean: {
    infinity: {
      src: '/images/clean-no-title/space8-infinity-room-chinese-eight-ball-table-san-po-kong-clean.webp',
      alt: 'Space Infinity 無限空間球室全景：新蒲崗自助中式桌球獨立球室，設星牌桌球枱及特調燈光',
      width: 2400,
      height: 1600,
      pos: '50% 56%',
    },
    eternity: {
      src: '/images/clean-no-title/space8-eternity-room-chinese-eight-ball-table-san-po-kong-clean.webp',
      alt: 'Space Eternity 永恆空間球室全景：設星牌桌球枱及球桿架的中式桌球獨立球室',
      width: 2400,
      height: 1600,
      pos: '50% 56%',
    },
  },
  titled: {
    infinity: {
      src: '/images/venue-page-infinity.jpg',
      alt: 'Space Infinity 無限空間球室全景：新蒲崗自助中式桌球獨立球室，設星牌桌球枱及特調燈光',
      width: 2400,
      height: 1500,
      pos: '50% 56%',
    },
    eternity: {
      src: '/images/venue-page-eternity.jpg',
      alt: 'Space Eternity 永恆空間球室全景：設星牌桌球枱及球桿架的中式桌球獨立球室',
      width: 2400,
      height: 1500,
      pos: '50% 56%',
    },
  },
} satisfies Record<string, { infinity: Img; eternity: Img }>

const IPAD: Img = {
  src: '/gallery/spacepliot.png',
  alt: 'AI 智能對戰管家 iPad 畫面',
  width: 4269,
  height: 2400,
}

/* ─────────────── content ─────────────── */

export const ROOM_VIEWER_DATA: RoomViewerData = {
  title: '兩間 1T 獨立球室',
  hint: '拖動滑桿以觀看兩間球室',
  rooms: {
    infinity: { name: 'Space Infinity', zh: '無限空間球室', label: 'Room 1' },
    eternity: { name: 'Space Eternity', zh: '永恆空間球室', label: 'Room 2' },
  },
  pills: [
    {
      id: 'deco',
      name: '場地裝修',
      main: '特調燈光和氛圍',
      compare: PANORAMA[PANORAMA_SET],
    },
    {
      id: 'comfort',
      name: '舒適自在',
      main: '舒適沙發休息區',
      compare: {
        infinity: {
          src: '/images/space8-infinity-room-lounge-sofa-armchair-side-table.webp',
          alt: 'Space Infinity 球室休息區，設有沙發、扶手椅及邊桌',
          width: 2048,
          height: 1365,
          pos: '52% 62%',
        },
        eternity: [
          {
            key: 'sofa',
            label: '沙發',
            src: '/images/space8-eternity-room-lounge-black-sofa.webp',
            alt: 'Space Eternity 球室休息區的黑色沙發',
            width: 1600,
            height: 1124,
            pos: '56% 62%',
          },
          {
            key: 'bar',
            label: '吧台',
            src: '/images/space8-eternity-room-bar-counter-black-stools.webp',
            alt: 'Space Eternity 球室吧台及兩張黑色吧台凳',
            width: 2048,
            height: 1365,
            pos: '62% 55%',
          },
        ],
      },
    },
    {
      id: 'pro',
      name: '專業設備',
      main: '精選桌球枱・比賽球',
      views: [
        {
          key: 'table',
          label: '桌球枱',
          src: '/images/xing-pai-chinese-eight-ball-table-corner-pocket-hong-kong.webp',
          alt: '星牌 XING PAI 桌球枱球袋近照，枱面放有比賽用球',
          width: 2048,
          height: 1365,
          pos: '62% 50%',
          title: '星牌 XING PAI',
          sub: '每間球室配備一張星牌桌球枱。',
        },
        {
          key: 'balls',
          label: '比賽球',
          src: '/images/super-aramith-pro-tv-pro-cup-billiard-balls-space8.webp',
          alt: 'Super Aramith Pro TV Pro-Cup 比賽球及球盒，放在綠色枱布上',
          width: 2400,
          height: 1694,
          pos: '55% 50%',
          title: 'Super Aramith Pro',
          sub: 'Aramith 比賽球',
          rows: [
            ['品牌', 'Aramith（比利時）'],
            ['型號', 'TV Pro-Cup'],
            ['球組', 'The Professional Tournament Set'],
          ],
        },
        {
          key: 'chalk',
          label: '巧粉',
          src: '/images/triangle-chalk-billiard-cue-chalk-space8.webp',
          alt: '兩塊 Triangle 巧粉放在托盤上',
          width: 2400,
          height: 1600,
          pos: '44% 52%',
          title: 'Triangle Chalk',
          sub: '經典 Triangle 品牌巧克粉・King of Them All',
        },
        {
          key: 'cue',
          label: '球桿',
          src: '/images/space8-cue-rack-professional-cues-close-up.webp',
          alt: 'SPACE8 專屬球桿架及專業球桿近照',
          width: 2400,
          height: 1913,
          pos: '55% 58%',
          title: 'SPACE8 球桿架',
          sub: '配備專業球桿。',
        },
      ],
    },
    {
      id: 'pilot',
      name: '科技體驗',
      main: 'AI 智能對戰管家',
      tag: '敬請期待',
      pilot: {
        image: IPAD,
        intro: '一套聰明的自助體驗，讓每個球室，每個球局與每一位會員都有更順暢的體驗。',
        points: [
          { icon: 'spark', name: 'AI 對戰系統', desc: '系統會推薦最適合公平的賽制，從雙人對戰到三五好友都有最適合的玩法。' },
          { icon: 'timer', name: '計分系統', desc: '自帶計分，計時，紅藍對戰雙方清晰醒目，隔著半個包廂也看得一清二楚。' },
          { icon: 'bars', name: '戰績自動累積', desc: '每一場勝負寫入個人總勝場，紀錄你的勝利時刻！' },
          { icon: 'play', name: '高清入球回放', desc: '完整球局可以在對戰結束後回放，回看精彩入球。', tag: '敬請期待' },
        ],
      },
    },
  ],
}
