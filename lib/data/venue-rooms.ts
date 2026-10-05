export type RoomId = 'infinity' | 'eternity'

export interface RoomContent {
  id: RoomId
  image: string
  alt: string
}

export interface PillContent {
  id: string
  labelKey: string
  mainLineKey: string
  smallLineKey?: string
  tag?: string
  hasSlider: boolean
  perRoom?: {
    infinity: {
      image: string
      alt: string
      smallLineKey?: string
    }
    eternity: {
      image: string
      alt: string
      smallLineKey?: string
    }
  }
  shared?: {
    image: string
    alt: string
  }
}

export const rooms: RoomContent[] = [
  {
    id: 'infinity',
    image: '/images/venue-page-infinity.jpg',
    alt: 'Space Infinity 球室全景',
  },
  {
    id: 'eternity',
    image: '/images/venue-page-eternity.jpg',
    alt: 'Space Eternity 球室全景',
  },
]

export const pills: PillContent[] = [
  {
    id: 'renovation',
    labelKey: 'venue.rooms.pills.renovation.label',
    mainLineKey: 'venue.rooms.pills.renovation.main',
    hasSlider: true,
    perRoom: {
      infinity: {
        // TODO: Replace with text-free panorama. Current image has "SPACE INFINITY"
        // baked into pixels. Luca to supply clean source. Cannot remove without
        // new asset — do not cover/blur/crop as workaround.
        image: '/images/venue-page-infinity.jpg',
        alt: 'Space Infinity 球室裝修和燈光氛圍',
      },
      eternity: {
        // TODO: Replace with text-free panorama. Current image has "SPACE ETERNITY"
        // baked into pixels. Luca to supply clean source. Cannot remove without
        // new asset — do not cover/blur/crop as workaround.
        image: '/images/venue-page-eternity.jpg',
        alt: 'Space Eternity 球室裝修和燈光氛圍',
      },
    },
  },
  {
    id: 'comfort',
    labelKey: 'venue.rooms.pills.comfort.label',
    mainLineKey: 'venue.rooms.pills.comfort.main',
    hasSlider: true,
    perRoom: {
      infinity: {
        image: '/images/space8-about-photos/images/about-06-lounge.webp',
        alt: 'Infinity Room 舒適沙發休息區',
        smallLineKey: 'venue.rooms.pills.comfort.small.infinity',
      },
      eternity: {
        image: '/images/space8-about-photos/images/about-07-stools.webp',
        alt: 'Eternity Room 舒適休息區',
        smallLineKey: 'venue.rooms.pills.comfort.small.eternity',
      },
    },
  },
  {
    id: 'equipment',
    labelKey: 'venue.rooms.pills.equipment.label',
    mainLineKey: 'venue.rooms.pills.equipment.main',
    hasSlider: false,
    shared: {
      image: '/images/space8-about-photos/images/about-03-corner-pocket.webp',
      alt: '專業桌球枱角袋特寫和 Aramith 比賽球',
    },
  },
  {
    id: 'technology',
    labelKey: 'venue.rooms.pills.technology.label',
    mainLineKey: 'venue.rooms.pills.technology.main',
    tag: 'venue.rooms.pills.technology.tag',
    hasSlider: false,
    shared: {
      image: '/gallery/spacepliot.png',
      alt: 'Space Pilot AI 智能對戰管家 iPad 介面',
    },
  },
]

export function getRoomById(id: RoomId): RoomContent {
  return rooms.find((r) => r.id === id) ?? rooms[0]
}

export function getPillImage(pillId: string, roomId: RoomId): { image: string; alt: string } {
  const pill = pills.find((p) => p.id === pillId)
  if (!pill) return { image: '', alt: '' }

  if (pill.perRoom) {
    return pill.perRoom[roomId]
  }
  return pill.shared ?? { image: '', alt: '' }
}
