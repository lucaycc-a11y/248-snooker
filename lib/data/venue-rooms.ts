export type RoomId = 'infinity' | 'eternity'

export interface RoomContent {
  id: RoomId
  nameKey: string
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
    nameKey: 'venue.rooms.infinity.name',
    image: '/images/venue-page-infinity.jpg',
    alt: 'Infinity Room panoramic view',
  },
  {
    id: 'eternity',
    nameKey: 'venue.rooms.eternity.name',
    image: '/images/venue-page-eternity.jpg',
    alt: 'Eternity Room panoramic view',
  },
]

export const pills: PillContent[] = [
  {
    id: 'renovation',
    labelKey: 'venue.rooms.pills.renovation.label',
    mainLineKey: 'venue.rooms.pills.renovation.main',
    smallLineKey: 'venue.rooms.pills.renovation.small',
    hasSlider: true,
    perRoom: {
      infinity: {
        image: '/images/venue-page-infinity.jpg',
        alt: 'Infinity Room interior design and renovation',
      },
      eternity: {
        image: '/images/venue-page-eternity.jpg',
        alt: 'Eternity Room interior design and renovation',
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
        image: '/images/about-06-lounge.webp',
        alt: 'Infinity Room comfortable lounge area with sofa',
        smallLineKey: 'venue.rooms.pills.comfort.small.infinity',
      },
      eternity: {
        image: '/images/about-07-stools.webp',
        alt: 'Eternity Room comfortable seating with bar stools',
        smallLineKey: 'venue.rooms.pills.comfort.small.eternity',
      },
    },
  },
  {
    id: 'equipment',
    labelKey: 'venue.rooms.pills.equipment.label',
    mainLineKey: 'venue.rooms.pills.equipment.main',
    smallLineKey: 'venue.rooms.pills.equipment.small',
    hasSlider: false,
    shared: {
      image: '/images/about-03-corner-pocket.webp',
      alt: 'Professional snooker table corner pocket with Aramith balls',
    },
  },
  {
    id: 'technology',
    labelKey: 'venue.rooms.pills.technology.label',
    mainLineKey: 'venue.rooms.pills.technology.main',
    smallLineKey: 'venue.rooms.pills.technology.small',
    tag: '敬請期待',
    hasSlider: false,
    shared: {
      image: '/gallery/spacepliot.png',
      alt: 'Space Pilot interactive scoring system on iPad',
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

export function getPillSmallLineKey(pillId: string, roomId: RoomId): string | undefined {
  const pill = pills.find((p) => p.id === pillId)
  if (!pill) return undefined

  if (pill.perRoom?.[roomId]?.smallLineKey) {
    return pill.perRoom[roomId].smallLineKey
  }

  return pill.smallLineKey
}
