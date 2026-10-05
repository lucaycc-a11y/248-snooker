export type PillId = 'renovation' | 'comfort' | 'equipment' | 'technology'
export type RoomId = 'infinity' | 'eternity'
export type EquipmentViewKey = 'table' | 'balls' | 'chalk' | 'cue'
export type EternityViewKey = 'sofa' | 'bar'

export interface ImageMeta {
  src: string
  alt: string
  width: number
  height: number
  objectPosition: string
}

export interface EquipmentView {
  key: EquipmentViewKey
  labelKey: string
  image: ImageMeta
  chipTitleKey: string
  detailTextKey?: string
  specsKey?: string
}

export interface EternityView {
  key: EternityViewKey
  labelKey: string
  image: ImageMeta
}

export interface TechnologyPoint {
  icon: 'spark' | 'timer' | 'bars' | 'play'
  nameKey: string
  descKey: string
  tag?: string
}

export interface Pill {
  id: PillId
  labelKey: string
  mainLineKey: string
  tag?: string
  hasSlider: boolean
  mode: 'compare' | 'single'

  // Compare mode (renovation, comfort)
  perRoom?: {
    infinity: ImageMeta
    eternity: ImageMeta
  }

  // Comfort-specific: Eternity has 2 views (sofa, bar)
  eternityViews?: EternityView[]

  // Equipment-specific: 4 thumbnail views
  views?: EquipmentView[]

  // Technology-specific
  introKey?: string
  points?: TechnologyPoint[]
  pilotImage?: ImageMeta
}

// Image base path
const IMG_BASE = '/images/space8-about-photos/images/space8-venue-images'

export const pills: Pill[] = [
  {
    id: 'renovation',
    labelKey: 'venue.rooms.pills.renovation.label',
    mainLineKey: 'venue.rooms.pills.renovation.main',
    hasSlider: true,
    mode: 'compare',
    perRoom: {
      infinity: {
        src: `${IMG_BASE}/clean-no-title/space8-infinity-room-chinese-eight-ball-table-san-po-kong-clean.webp`,
        alt: 'Space Infinity 無限空間球室全景：新蒲崗自助中式桌球獨立球室，設星牌桌球枱及特調燈光',
        width: 2400,
        height: 1600,
        objectPosition: '50% 56%',
      },
      eternity: {
        src: `${IMG_BASE}/clean-no-title/space8-eternity-room-chinese-eight-ball-table-san-po-kong-clean.webp`,
        alt: 'Space Eternity 永恆空間球室全景：設星牌桌球枱及球桿架的中式桌球獨立球室',
        width: 2400,
        height: 1600,
        objectPosition: '50% 56%',
      },
    },
  },
  {
    id: 'comfort',
    labelKey: 'venue.rooms.pills.comfort.label',
    mainLineKey: 'venue.rooms.pills.comfort.main',
    hasSlider: true,
    mode: 'compare',
    perRoom: {
      infinity: {
        src: `${IMG_BASE}/space8-infinity-room-lounge-sofa-armchair-side-table.webp`,
        alt: 'Space Infinity 球室休息區，設有沙發、扶手椅及邊桌',
        width: 2048,
        height: 1365,
        objectPosition: '52% 62%',
      },
      // Default Eternity view (sofa)
      eternity: {
        src: `${IMG_BASE}/space8-eternity-room-lounge-black-sofa.webp`,
        alt: 'Space Eternity 球室休息區的黑色沙發',
        width: 1600,
        height: 1124,
        objectPosition: '56% 62%',
      },
    },
    eternityViews: [
      {
        key: 'sofa',
        labelKey: 'venue.rooms.pills.comfort.eternity_switch.sofa',
        image: {
          src: `${IMG_BASE}/space8-eternity-room-lounge-black-sofa.webp`,
          alt: 'Space Eternity 球室休息區的黑色沙發',
          width: 1600,
          height: 1124,
          objectPosition: '56% 62%',
        },
      },
      {
        key: 'bar',
        labelKey: 'venue.rooms.pills.comfort.eternity_switch.bar',
        image: {
          src: `${IMG_BASE}/space8-eternity-room-bar-counter-black-stools.webp`,
          alt: 'Space Eternity 球室吧台及兩張黑色吧台凳',
          width: 2048,
          height: 1365,
          objectPosition: '62% 55%',
        },
      },
    ],
  },
  {
    id: 'equipment',
    labelKey: 'venue.rooms.pills.equipment.label',
    mainLineKey: 'venue.rooms.pills.equipment.main',
    hasSlider: false,
    mode: 'single',
    views: [
      {
        key: 'table',
        labelKey: 'venue.rooms.pills.equipment.views.table.label',
        image: {
          src: `${IMG_BASE}/xing-pai-chinese-eight-ball-table-corner-pocket-hong-kong.webp`,
          alt: '星牌 XING PAI 桌球枱球袋近照，枱面放有比賽用球',
          width: 2048,
          height: 1365,
          objectPosition: '62% 50%',
        },
        chipTitleKey: 'venue.rooms.pills.equipment.views.table.title',
        detailTextKey: 'venue.rooms.pills.equipment.views.table.detail',
      },
      {
        key: 'balls',
        labelKey: 'venue.rooms.pills.equipment.views.balls.label',
        image: {
          src: `${IMG_BASE}/super-aramith-pro-tv-pro-cup-billiard-balls-space8.webp`,
          alt: 'Super Aramith Pro TV Pro-Cup 比賽球及球盒，放在綠色枱布上',
          width: 2400,
          height: 1694,
          objectPosition: '55% 50%',
        },
        chipTitleKey: 'venue.rooms.pills.equipment.views.balls.title',
        specsKey: 'venue.rooms.pills.equipment.views.balls.specs',
      },
      {
        key: 'chalk',
        labelKey: 'venue.rooms.pills.equipment.views.chalk.label',
        image: {
          src: `${IMG_BASE}/triangle-chalk-billiard-cue-chalk-space8.webp`,
          alt: '兩塊 Triangle 巧粉放在托盤上',
          width: 2400,
          height: 1600,
          objectPosition: '44% 52%',
        },
        chipTitleKey: 'venue.rooms.pills.equipment.views.chalk.title',
        detailTextKey: 'venue.rooms.pills.equipment.views.chalk.detail',
      },
      {
        key: 'cue',
        labelKey: 'venue.rooms.pills.equipment.views.cue.label',
        image: {
          src: `${IMG_BASE}/space8-cue-rack-professional-cues-close-up.webp`,
          alt: 'SPACE8 專屬球桿架及專業球桿近照',
          width: 2400,
          height: 1913,
          objectPosition: '55% 58%',
        },
        chipTitleKey: 'venue.rooms.pills.equipment.views.cue.title',
        detailTextKey: 'venue.rooms.pills.equipment.views.cue.detail',
      },
    ],
  },
  {
    id: 'technology',
    labelKey: 'venue.rooms.pills.technology.label',
    mainLineKey: 'venue.rooms.pills.technology.main',
    tag: 'venue.rooms.pills.technology.tag',
    hasSlider: false,
    mode: 'single',
    introKey: 'venue.rooms.pills.technology.intro',
    points: [
      {
        icon: 'spark',
        nameKey: 'venue.rooms.pills.technology.points.ai.name',
        descKey: 'venue.rooms.pills.technology.points.ai.desc',
      },
      {
        icon: 'timer',
        nameKey: 'venue.rooms.pills.technology.points.score.name',
        descKey: 'venue.rooms.pills.technology.points.score.desc',
      },
      {
        icon: 'bars',
        nameKey: 'venue.rooms.pills.technology.points.stats.name',
        descKey: 'venue.rooms.pills.technology.points.stats.desc',
      },
      {
        icon: 'play',
        nameKey: 'venue.rooms.pills.technology.points.replay.name',
        descKey: 'venue.rooms.pills.technology.points.replay.desc',
        tag: 'venue.rooms.pills.technology.tag',
      },
    ],
    pilotImage: {
      src: '/gallery/spacepliot.png',
      alt: 'Space Pilot AI 智能對戰管家 iPad 介面',
      width: 2048,
      height: 2732,
      objectPosition: '50% 50%',
    },
  },
]

export const roomLabels = {
  infinity: {
    nameKey: 'venue.rooms.infinity.name',
    english: 'Space Infinity',
    chinese: '無限空間球室',
    room: 'Room 1',
  },
  eternity: {
    nameKey: 'venue.rooms.eternity.name',
    english: 'Space Eternity',
    chinese: '永恆空間球室',
    room: 'Room 2',
  },
}
